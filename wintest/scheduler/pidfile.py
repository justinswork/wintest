"""PID-file management for the wintest scheduler process."""

import json
import os
from datetime import datetime
from pathlib import Path


def _pid_path() -> Path:
    local = os.environ.get("LOCALAPPDATA")
    if local:
        base = Path(local) / "wintest"
    else:
        base = Path.home() / ".wintest"
    base.mkdir(parents=True, exist_ok=True)
    return base / "scheduler.pid"


def write_pid() -> None:
    with open(_pid_path(), "w") as f:
        json.dump(
            {"pid": os.getpid(), "started_at": datetime.now().isoformat()},
            f,
        )


def read_pid() -> dict | None:
    path = _pid_path()
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def remove_pid() -> None:
    try:
        _pid_path().unlink()
    except FileNotFoundError:
        pass


def _pid_alive(pid: int) -> bool:
    """Check whether a PID refers to a live process (Windows-safe)."""
    if pid <= 0:
        return False
    try:
        import psutil  # type: ignore
        return psutil.pid_exists(pid)
    except ImportError:
        pass
    # Fallback: OpenProcess via ctypes on Windows
    try:
        import ctypes
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        try:
            exit_code = ctypes.c_ulong()
            if kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                STILL_ACTIVE = 259
                return exit_code.value == STILL_ACTIVE
            return False
        finally:
            kernel32.CloseHandle(handle)
    except Exception:
        return False


def is_scheduler_running() -> tuple[bool, dict | None]:
    """Return (running, info) — info is the PID file contents if present."""
    info = read_pid()
    if info is None:
        return False, None
    pid = info.get("pid")
    if isinstance(pid, int) and _pid_alive(pid):
        return True, info
    # stale PID file
    remove_pid()
    return False, None


def _stop_flag_path() -> Path:
    local = os.environ.get("LOCALAPPDATA")
    if local:
        base = Path(local) / "wintest"
    else:
        base = Path.home() / ".wintest"
    base.mkdir(parents=True, exist_ok=True)
    return base / "scheduler.stop"


def request_stop() -> None:
    _stop_flag_path().write_text("stop")


def is_stop_requested() -> bool:
    return _stop_flag_path().exists()


def clear_stop_flag() -> None:
    try:
        _stop_flag_path().unlink()
    except FileNotFoundError:
        pass


def _current_run_path() -> Path:
    local = os.environ.get("LOCALAPPDATA")
    if local:
        base = Path(local) / "wintest"
    else:
        base = Path.home() / ".wintest"
    base.mkdir(parents=True, exist_ok=True)
    return base / "scheduler_current_run.json"


def write_current_run(info: dict) -> None:
    with open(_current_run_path(), "w") as f:
        json.dump(info, f)


def read_current_run() -> dict | None:
    path = _current_run_path()
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def clear_current_run() -> None:
    try:
        _current_run_path().unlink()
    except FileNotFoundError:
        pass


def runs_state_path() -> Path:
    local = os.environ.get("LOCALAPPDATA")
    if local:
        base = Path(local) / "wintest"
    else:
        base = Path.home() / ".wintest"
    base.mkdir(parents=True, exist_ok=True)
    return base / "scheduler_runs.json"


def load_runs_state() -> dict:
    path = runs_state_path()
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def save_runs_state(state: dict) -> None:
    with open(runs_state_path(), "w") as f:
        json.dump(state, f, indent=2)
