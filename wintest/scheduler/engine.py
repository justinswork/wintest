"""Pipeline scheduler engine.

Long-running loop that reads pipeline YAML files from the workspace and fires
test/suite runs at their scheduled day+time.
"""

import logging
import signal
import threading
from datetime import datetime
from pathlib import Path

from ..config import workspace
from ..config.settings import Settings
from ..tasks.pipeline_loader import load_pipeline
from ..tasks.pipeline_schema import PipelineDefinition
from ..tasks.loader import load_test
from ..tasks.runner import TestRunner
from ..tasks.test_suite_loader import load_test_suite
from ..tasks.test_suite_runner import TestSuiteRunner
from ..core.screen import ScreenCapture
from ..core.actions import ActionExecutor
from ..core.agent import Agent
from . import pidfile

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 30


def _step_needs_vision(step) -> bool:
    """Mirror of execution_service._needs_vision for scheduler use."""
    if step.action in ("click", "double_click", "right_click", "verify"):
        if step.click_x is not None and step.click_y is not None:
            return False
        return True
    return False


def _test_needs_vision(test_path: Path, settings: Settings) -> bool:
    try:
        test = load_test(str(test_path), settings=settings)
    except Exception:
        return False
    return any(_step_needs_vision(s) for s in test.steps)


class SchedulerEngine:
    """Core loop that checks pipelines once per minute and triggers runs."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._stop_event = threading.Event()
        self._vision = None  # Lazy-loaded vision model, reused across runs

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        pidfile.write_pid()
        pidfile.clear_stop_flag()  # clear any leftover stop flag from prior session
        logger.info("Scheduler started (pid=%s). Checking every %ds.",
                    pidfile.read_pid().get("pid") if pidfile.read_pid() else "?",
                    CHECK_INTERVAL_SECONDS)
        try:
            # Install signal handlers so Ctrl+C / taskkill leads to clean shutdown
            for sig in (signal.SIGINT, signal.SIGTERM):
                try:
                    signal.signal(sig, lambda *_: self.stop())
                except (ValueError, OSError):
                    pass  # not on main thread
            while not self._stop_event.is_set():
                try:
                    self._tick()
                except Exception:
                    logger.exception("Scheduler tick failed")
                # Wake every second to check for the stop flag so UI/CLI
                # stop requests are honored promptly (not only every 30s)
                for _ in range(CHECK_INTERVAL_SECONDS):
                    if self._stop_event.wait(1):
                        break
                    if pidfile.is_stop_requested():
                        logger.info("Stop requested — shutting down.")
                        self._stop_event.set()
                        break
        finally:
            pidfile.clear_stop_flag()
            pidfile.clear_current_run()
            pidfile.remove_pid()
            logger.info("Scheduler stopped.")

    def _tick(self) -> None:
        if not workspace.is_configured():
            return
        pdir = workspace.pipelines_dir()
        if not pdir.exists():
            return

        now = datetime.now()
        current_day = now.strftime("%A").lower()
        current_time = now.strftime("%H:%M")
        today_key = now.strftime("%Y-%m-%d")

        runs_state = pidfile.load_runs_state()

        for path in sorted(pdir.rglob("*.yaml")):
            rel = path.relative_to(pdir).as_posix()
            try:
                pipeline = load_pipeline(str(path))
            except Exception as e:
                logger.warning("Skipping invalid pipeline %s: %s", rel, e)
                continue

            if not pipeline.enabled:
                continue
            if current_day not in pipeline.schedule_days:
                continue
            if current_time != pipeline.schedule_time:
                continue

            run_info = runs_state.get(rel, {})
            if run_info.get("last_fired_date") == today_key and \
               run_info.get("last_fired_time") == current_time:
                continue

            logger.info("Firing pipeline: %s", rel)
            pidfile.write_current_run({
                "pipeline_filename": rel,
                "pipeline_name": pipeline.name,
                "target_type": pipeline.target_type,
                "target_file": pipeline.target_file,
                "started_at": now.isoformat(),
            })
            passed = False
            try:
                passed = self._execute_pipeline(pipeline)
            except Exception:
                logger.exception("Pipeline %s failed", rel)
            finally:
                pidfile.clear_current_run()

            runs_state[rel] = {
                "last_fired_date": today_key,
                "last_fired_time": current_time,
                "last_run_at": now.isoformat(),
                "last_run_passed": passed,
            }
            pidfile.save_runs_state(runs_state)

    def _ensure_vision(self):
        if self._vision is None:
            from ..core.vision import VisionModel
            logger.info("Loading AI vision model...")
            vision = VisionModel(model_settings=self.settings.model)
            vision.load()
            self._vision = vision
            logger.info("Model loaded.")
        return self._vision

    def _execute_pipeline(self, pipeline: PipelineDefinition) -> bool:
        screen = ScreenCapture(coordinate_scale=self.settings.action.coordinate_scale)
        actions = ActionExecutor(action_settings=self.settings.action)

        if pipeline.target_type == "suite":
            suite_path = workspace.suites_dir() / pipeline.target_file
            suite = load_test_suite(str(suite_path))
            needs = False
            for tp in suite.test_paths:
                if _test_needs_vision(workspace.tests_dir() / tp, self.settings):
                    needs = True
                    break
            vision = self._ensure_vision() if needs else None
            agent = Agent(vision, screen, actions)
            runner = TestRunner(agent, settings=self.settings)
            suite_runner = TestSuiteRunner(runner, settings=self.settings)
            result = suite_runner.run(suite)
            return result.passed

        # test
        test_path = workspace.tests_dir() / pipeline.target_file
        test = load_test(str(test_path), settings=self.settings)
        needs = any(_step_needs_vision(s) for s in test.steps)
        vision = self._ensure_vision() if needs else None
        agent = Agent(vision, screen, actions)
        runner = TestRunner(agent, settings=self.settings)
        result = runner.run(test)
        return result.passed
