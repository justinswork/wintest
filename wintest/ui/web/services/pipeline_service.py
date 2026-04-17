"""Service for pipeline file CRUD and scheduler status."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

from ....tasks.pipeline_loader import load_pipeline
from ....config import workspace
from ....scheduler import pidfile
from ..models import PipelineModel, PipelineListItem, SchedulerStatus, SchedulerCurrentRun


def list_pipelines() -> list[PipelineListItem]:
    """List all pipeline YAML files in the pipelines directory."""
    if not workspace.is_configured():
        return []
    pipelines_dir = workspace.pipelines_dir()
    if not pipelines_dir.exists():
        return []

    runs = pidfile.load_runs_state()

    items: list[PipelineListItem] = []
    for path in sorted(pipelines_dir.rglob("*.yaml")):
        rel_path = path.relative_to(pipelines_dir).as_posix()
        try:
            pipeline = load_pipeline(str(path))
            run_info = runs.get(rel_path, {})
            items.append(PipelineListItem(
                filename=rel_path,
                name=pipeline.name,
                enabled=pipeline.enabled,
                target_type=pipeline.target_type,
                target_file=pipeline.target_file,
                schedule_days=pipeline.schedule_days,
                schedule_time=pipeline.schedule_time,
                last_run_at=run_info.get("last_run_at"),
                last_run_passed=run_info.get("last_run_passed"),
            ))
        except Exception:
            items.append(PipelineListItem(
                filename=rel_path,
                name=f"(invalid: {rel_path})",
                enabled=False,
                target_type="test",
                target_file="",
                schedule_days=[],
                schedule_time="00:00",
            ))
    return items


def get_pipeline(filename: str) -> PipelineModel:
    path = _resolve_path(filename)
    pipeline = load_pipeline(str(path))
    return PipelineModel(
        name=pipeline.name,
        filename=filename,
        enabled=pipeline.enabled,
        target_type=pipeline.target_type,
        target_file=pipeline.target_file,
        schedule_days=pipeline.schedule_days,
        schedule_time=pipeline.schedule_time,
    )


def save_pipeline(pipeline: PipelineModel, filename: str | None = None) -> str:
    if filename is None:
        filename = pipeline.filename
    if filename is None:
        safe_name = pipeline.name.lower().replace(" ", "_")
        filename = f"{safe_name}.yaml"

    data = {
        "name": pipeline.name,
        "enabled": pipeline.enabled,
        "target_type": pipeline.target_type,
        "target_file": pipeline.target_file,
        "schedule": {
            "days": pipeline.schedule_days,
            "time": pipeline.schedule_time,
        },
    }

    pipelines_dir = workspace.pipelines_dir()
    pipelines_dir.mkdir(exist_ok=True)
    path = pipelines_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = path.with_suffix(".yaml.tmp")
    with open(tmp_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    os.replace(str(tmp_path), str(path))

    return filename


def delete_pipeline(filename: str) -> None:
    path = _resolve_path(filename)
    path.unlink()


def set_enabled(filename: str, enabled: bool) -> None:
    path = _resolve_path(filename)
    pipeline = load_pipeline(str(path))
    model = PipelineModel(
        name=pipeline.name,
        filename=filename,
        enabled=enabled,
        target_type=pipeline.target_type,
        target_file=pipeline.target_file,
        schedule_days=pipeline.schedule_days,
        schedule_time=pipeline.schedule_time,
    )
    save_pipeline(model, filename=filename)


def get_scheduler_status() -> SchedulerStatus:
    running, info = pidfile.is_scheduler_running()
    current = None
    if running:
        raw = pidfile.read_current_run()
        if raw:
            try:
                current = SchedulerCurrentRun(**raw)
            except Exception:
                current = None
    if running and info:
        return SchedulerStatus(
            running=True,
            pid=info.get("pid"),
            started_at=info.get("started_at"),
            current_run=current,
        )
    return SchedulerStatus(running=False)


def stop_scheduler(timeout_seconds: float = 5.0) -> dict:
    """Ask the scheduler to shut down. Falls back to force-kill after timeout."""
    import time

    running, info = pidfile.is_scheduler_running()
    if not running or not info:
        pidfile.clear_stop_flag()
        return {"stopped": False, "reason": "not_running"}

    pid = info.get("pid")
    pidfile.request_stop()

    # Poll for process exit
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        still_running, _ = pidfile.is_scheduler_running()
        if not still_running:
            return {"stopped": True, "forced": False, "pid": pid}
        time.sleep(0.5)

    # Force-kill as fallback
    forced = _force_kill(pid)
    pidfile.clear_stop_flag()
    pidfile.clear_current_run()
    pidfile.remove_pid()
    return {"stopped": forced, "forced": True, "pid": pid}


def _force_kill(pid: int | None) -> bool:
    if not pid:
        return False
    if sys.platform == "win32":
        try:
            subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            return True
        except Exception:
            return False
    try:
        import signal as _signal
        os.kill(pid, _signal.SIGKILL)
        return True
    except Exception:
        return False


def start_scheduler() -> dict:
    """Spawn `wintest scheduler` as a detached background process."""
    import time

    running, info = pidfile.is_scheduler_running()
    if running:
        return {"started": False, "reason": "already_running", "pid": info.get("pid") if info else None}

    # Clear any stale stop flag left behind by a previous session
    pidfile.clear_stop_flag()

    cmd = _resolve_scheduler_command()

    creationflags = 0
    if sys.platform == "win32":
        # CREATE_NO_WINDOW suppresses the console window for the child process
        # CREATE_NEW_PROCESS_GROUP detaches it from the parent's Ctrl+C handling
        # so the scheduler survives even after the web server shuts down
        creationflags = (
            getattr(subprocess, "CREATE_NO_WINDOW", 0)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        )

    try:
        proc = subprocess.Popen(
            cmd,
            close_fds=True,
            creationflags=creationflags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError as e:
        return {"started": False, "reason": "command_not_found", "command": cmd, "error": str(e)}
    except Exception as e:
        return {"started": False, "reason": "spawn_failed", "command": cmd, "error": str(e)}

    # Wait up to 5 seconds for the child to write its PID file
    deadline = time.monotonic() + 5.0
    while time.monotonic() < deadline:
        running, info = pidfile.is_scheduler_running()
        if running and info:
            return {"started": True, "pid": info.get("pid")}
        exit_code = proc.poll()
        if exit_code is not None:
            return {
                "started": False,
                "reason": "exited_early",
                "command": cmd,
                "exit_code": exit_code,
            }
        time.sleep(0.25)

    return {"started": False, "reason": "timeout", "command": cmd}


def _resolve_scheduler_command() -> list[str]:
    """Build the command list that launches `wintest scheduler`.

    Prefers `pythonw -m wintest scheduler` on Windows so no console is attached.
    Falls back to the `wintest` console script elsewhere.
    """
    if sys.platform == "win32":
        python_dir = Path(sys.executable).parent
        pythonw = python_dir / "pythonw.exe"
        if pythonw.exists():
            return [str(pythonw), "-m", "wintest", "scheduler"]

    wintest_bin = shutil.which("wintest")
    if wintest_bin:
        return [wintest_bin, "scheduler"]
    return [sys.executable, "-m", "wintest", "scheduler"]


def _resolve_path(filename: str) -> Path:
    path = workspace.pipelines_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Pipeline file not found: {filename}")
    return path
