"""Service for running tests asynchronously with WebSocket progress."""

import asyncio
import base64
import logging
import os
import uuid

from ....core.vision import VisionModel
from ....core.screen import ScreenCapture
from ....core.actions import ActionExecutor
from ....core.agent import Agent
from ....tasks.loader import load_test
from ....tasks.runner import TestRunner
from ....tasks.test_suite_loader import load_test_suite
from ....tasks.test_suite_runner import TestSuiteRunner
from ..state import AppState, RunState

logger = logging.getLogger(__name__)


class WebSocketProgressCallback:
    """Bridges synchronous TestRunner callbacks to async WebSocket broadcasts."""

    def __init__(self, run_id: str, total_steps: int, app_state: AppState):
        self.run_id = run_id
        self.total_steps = total_steps
        self.app_state = app_state

    def is_cancelled(self) -> bool:
        run = self.app_state.current_run
        return run is not None and run.cancel_event.is_set()

    def on_step_start(self, step_num: int, label: str):
        if self.app_state.current_run:
            self.app_state.current_run.current_step = step_num

        self.app_state.broadcast_sync({
            "type": "step_started",
            "run_id": self.run_id,
            "step_num": step_num,
            "total_steps": self.total_steps,
            "label": label,
        })

    def on_step_complete(self, step_num: int, result):
        screenshot_b64 = None
        if result.screenshot_path and os.path.exists(result.screenshot_path):
            with open(result.screenshot_path, "rb") as f:
                screenshot_b64 = base64.b64encode(f.read()).decode()

        step_data = {
            "step_num": step_num,
            "description": result.step.description or result.step.action,
            "action": result.step.action,
            "passed": result.passed,
            "duration_seconds": round(result.duration_seconds, 2),
            "error": result.error,
            "coordinates": list(result.coordinates) if result.coordinates else None,
            "screenshot_base64": screenshot_b64,
        }

        if self.app_state.current_run:
            self.app_state.current_run.step_results.append(step_data)

        self.app_state.broadcast_sync({
            "type": "step_completed",
            "run_id": self.run_id,
            **step_data,
        })


def start_run(test_file: str, app_state: AppState) -> dict:
    """Start a test run in the thread pool. Returns run info."""
    if app_state.current_run and app_state.current_run.status == "running":
        return None  # caller should return 409

    path = os.path.join("tests", test_file)
    test = load_test(path, settings=app_state.settings)

    run_id = str(uuid.uuid4())
    run_state = RunState(
        run_id=run_id,
        test_name=test.name,
        status="running",
        total_steps=len(test.steps),
        source_file=test_file,
        run_type="test",
    )
    app_state.current_run = run_state

    app_state.broadcast_sync({
        "type": "run_started",
        "run_id": run_id,
        "test_name": test.name,
        "total_steps": len(test.steps),
        "source_file": test_file,
        "run_type": "test",
    })

    loop = app_state.loop
    app_state.executor.submit(_run_test, test_file, run_id, app_state, loop)

    return {
        "run_id": run_id,
        "status": "started",
        "test_name": test.name,
        "total_steps": len(test.steps),
    }


def _run_test(test_file: str, run_id: str, app_state: AppState, loop: asyncio.AbstractEventLoop):
    """Execute the test in a worker thread."""
    try:
        # Ensure model is loaded
        if app_state.vision_model is None:
            app_state.model_status = "loading"
            app_state.broadcast_sync({"type": "model_loading", "message": "Loading AI model..."})

            vision = VisionModel(model_settings=app_state.settings.model)
            vision.load()

            app_state.vision_model = vision
            app_state.model_status = "loaded"
            app_state.broadcast_sync({"type": "model_loaded", "message": "Model loaded."})
        else:
            vision = app_state.vision_model

        path = os.path.join("tests", test_file)
        test = load_test(path, settings=app_state.settings)

        screen = ScreenCapture(coordinate_scale=app_state.settings.action.coordinate_scale)
        actions = ActionExecutor(action_settings=app_state.settings.action)
        agent = Agent(vision, screen, actions)

        runner = TestRunner(agent, settings=app_state.settings)
        callback = WebSocketProgressCallback(
            run_id=run_id,
            total_steps=len(test.steps),
            app_state=app_state,
        )

        result = runner.run(test, progress_callback=callback)

        cancelled = app_state.current_run and app_state.current_run.cancel_event.is_set()

        if app_state.current_run and app_state.current_run.run_id == run_id:
            if cancelled:
                app_state.current_run.status = "cancelled"
            else:
                app_state.current_run.status = "completed" if result.passed else "failed"

        if cancelled:
            app_state.broadcast_sync({
                "type": "run_cancelled",
                "run_id": run_id,
            })
        else:
            app_state.broadcast_sync({
                "type": "run_completed",
                "run_id": run_id,
                "passed": result.passed,
                "summary": result.summary,
            })

    except Exception as e:
        logger.error("Run %s failed: %s", run_id, e)
        if app_state.current_run and app_state.current_run.run_id == run_id:
            app_state.current_run.status = "failed"

        app_state.broadcast_sync({
            "type": "run_failed",
            "run_id": run_id,
            "error": str(e),
        })

    finally:
        if app_state.current_run and app_state.current_run.run_id == run_id:
            app_state.last_run = app_state.current_run
            if app_state.current_run.status == "running":
                app_state.current_run.status = "failed"


def cancel_run(app_state: AppState) -> bool:
    """Request cancellation of the current run. Returns True if a run was cancelled."""
    run = app_state.current_run
    if run is None or run.status != "running":
        return False
    run.cancel_event.set()
    return True


def load_model(app_state: AppState):
    """Pre-load the vision model without running a test."""
    if app_state.model_status == "loaded":
        return
    if app_state.model_status == "loading":
        return

    app_state.model_status = "loading"
    app_state.broadcast_sync({"type": "model_loading", "message": "Loading AI model..."})

    def _load():
        try:
            vision = VisionModel(model_settings=app_state.settings.model)
            vision.load()
            app_state.vision_model = vision
            app_state.model_status = "loaded"
            app_state.broadcast_sync({"type": "model_loaded", "message": "Model loaded."})
        except Exception as e:
            app_state.model_status = "not_loaded"
            logger.error("Failed to load model: %s", e)

    app_state.executor.submit(_load)


def start_test_suite_run(suite_file: str, app_state: AppState) -> dict:
    """Start a test suite run in the thread pool. Returns run info."""
    if app_state.current_run and app_state.current_run.status == "running":
        return None

    path = os.path.join("test_suites", suite_file)
    suite = load_test_suite(path)

    run_id = str(uuid.uuid4())
    run_state = RunState(
        run_id=run_id,
        test_name=f"Suite: {suite.name}",
        status="running",
        total_steps=0,
        source_file=suite_file,
        run_type="suite",
    )
    app_state.current_run = run_state

    app_state.broadcast_sync({
        "type": "test_suite_started",
        "run_id": run_id,
        "suite_name": suite.name,
        "total_tests": len(suite.test_paths),
        "source_file": suite_file,
        "run_type": "suite",
    })

    loop = app_state.loop
    app_state.executor.submit(_run_test_suite, suite_file, run_id, app_state, loop)

    return {
        "run_id": run_id,
        "status": "started",
        "suite_name": suite.name,
        "total_tests": len(suite.test_paths),
    }


def _run_test_suite(suite_file: str, run_id: str, app_state: AppState, loop: asyncio.AbstractEventLoop):
    """Execute the test suite in a worker thread."""
    try:
        if app_state.vision_model is None:
            app_state.model_status = "loading"
            app_state.broadcast_sync({"type": "model_loading", "message": "Loading AI model..."})

            vision = VisionModel(model_settings=app_state.settings.model)
            vision.load()

            app_state.vision_model = vision
            app_state.model_status = "loaded"
            app_state.broadcast_sync({"type": "model_loaded", "message": "Model loaded."})
        else:
            vision = app_state.vision_model

        path = os.path.join("test_suites", suite_file)
        suite = load_test_suite(path)

        screen = ScreenCapture(coordinate_scale=app_state.settings.action.coordinate_scale)
        actions = ActionExecutor(action_settings=app_state.settings.action)
        agent = Agent(vision, screen, actions)

        runner = TestRunner(agent, settings=app_state.settings)
        test_suite_runner = TestSuiteRunner(runner, settings=app_state.settings)

        def on_test_start(idx, name, total):
            app_state.broadcast_sync({
                "type": "test_suite_test_started",
                "run_id": run_id,
                "test_index": idx,
                "test_name": name,
                "total_tests": total,
            })

        def on_test_complete(idx, result):
            app_state.broadcast_sync({
                "type": "test_suite_test_completed",
                "run_id": run_id,
                "test_index": idx,
                "test_name": result.test_name,
                "passed": result.passed,
                "summary": result.summary,
            })

        cancel_check = lambda: app_state.current_run and app_state.current_run.cancel_event.is_set()

        suite_result = test_suite_runner.run(
            suite,
            on_test_start=on_test_start,
            on_test_complete=on_test_complete,
            cancel_check=cancel_check,
        )

        cancelled = app_state.current_run and app_state.current_run.cancel_event.is_set()

        if app_state.current_run and app_state.current_run.run_id == run_id:
            if cancelled:
                app_state.current_run.status = "cancelled"
            else:
                app_state.current_run.status = "completed" if suite_result.passed else "failed"

        if cancelled:
            app_state.broadcast_sync({
                "type": "run_cancelled",
                "run_id": run_id,
            })
        else:
            app_state.broadcast_sync({
                "type": "test_suite_completed",
                "run_id": run_id,
                "passed": suite_result.passed,
                "summary": suite_result.summary,
            })

    except Exception as e:
        logger.error("Suite run %s failed: %s", run_id, e)
        if app_state.current_run and app_state.current_run.run_id == run_id:
            app_state.current_run.status = "failed"

        app_state.broadcast_sync({
            "type": "run_failed",
            "run_id": run_id,
            "error": str(e),
        })

    finally:
        if app_state.current_run and app_state.current_run.run_id == run_id:
            app_state.last_run = app_state.current_run
            if app_state.current_run.status == "running":
                app_state.current_run.status = "failed"
