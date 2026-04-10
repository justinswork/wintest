"""Service for running tests asynchronously with WebSocket progress."""

import asyncio
import base64
import logging
import os
import uuid
from datetime import datetime

from ....core.vision import VisionModel
from ....core.screen import ScreenCapture
from ....core.actions import ActionExecutor
from ....core.agent import Agent
from ....core.app_manager import ApplicationManager, AppConfig
from ....core.recovery import RecoveryStrategy
from ....steps import registry
from ....tasks.schema import Step, StepResult
from ....config import workspace
from ....tasks.loader import load_test
from ....tasks.runner import TestRunner
from ....tasks.test_suite_loader import load_test_suite
from ....tasks.test_suite_runner import TestSuiteRunner
from ..state import AppState, RunState

logger = logging.getLogger(__name__)


class WebSocketLogHandler(logging.Handler):
    """Broadcasts log records to WebSocket clients during a test run."""

    def __init__(self, run_id: str, app_state: AppState):
        super().__init__()
        self.run_id = run_id
        self.app_state = app_state

    def emit(self, record: logging.LogRecord):
        try:
            self.app_state.broadcast_sync({
                "type": "log",
                "run_id": self.run_id,
                "level": record.levelname,
                "message": self.format(record),
                "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
            })
        except Exception:
            pass


def _attach_log_handler(run_id: str, app_state: AppState) -> WebSocketLogHandler:
    """Attach a WebSocket log handler to the wintest logger."""
    handler = WebSocketLogHandler(run_id, app_state)
    handler.setFormatter(logging.Formatter("%(name)s: %(message)s"))
    logging.getLogger("wintest").addHandler(handler)
    return handler


def _detach_log_handler(handler: WebSocketLogHandler):
    """Remove the WebSocket log handler."""
    logging.getLogger("wintest").removeHandler(handler)


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

    path = str(workspace.tests_dir() / test_file)
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
    log_handler = _attach_log_handler(run_id, app_state)
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

        path = str(workspace.tests_dir() / test_file)
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
        _detach_log_handler(log_handler)
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

    path = str(workspace.suites_dir() / suite_file)
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
    log_handler = _attach_log_handler(run_id, app_state)
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

        path = str(workspace.suites_dir() / suite_file)
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
        _detach_log_handler(log_handler)
        if app_state.current_run and app_state.current_run.run_id == run_id:
            app_state.last_run = app_state.current_run
            if app_state.current_run.status == "running":
                app_state.current_run.status = "failed"


# ── Builder: single-step execution ──────────────────────────────────


class BuilderState:
    """Holds state for the interactive test builder session."""

    def __init__(self, app_state: AppState):
        self.app_state = app_state
        self.settings = app_state.settings
        self.screen = ScreenCapture(coordinate_scale=app_state.settings.action.coordinate_scale)
        self.actions = ActionExecutor(action_settings=app_state.settings.action)
        self.agent: Agent | None = None
        self.app_manager: ApplicationManager | None = None
        self.recovery: RecoveryStrategy | None = None

    def ensure_agent(self) -> Agent:
        """Create the agent, loading the vision model if needed."""
        if self.agent is not None:
            return self.agent
        vision = _ensure_model(self.app_state)
        self.agent = Agent(vision, self.screen, self.actions)
        self.agent.report_dir = None
        return self.agent


def _ensure_model(app_state: AppState) -> VisionModel:
    """Ensure the vision model is loaded, loading it synchronously if needed."""
    if app_state.vision_model is None:
        app_state.model_status = "loading"
        vision = VisionModel(model_settings=app_state.settings.model)
        vision.load()
        app_state.vision_model = vision
        app_state.model_status = "loaded"
    return app_state.vision_model


def start_builder(app_state: AppState) -> BuilderState:
    """Initialize a builder session (does not load the AI model)."""
    return BuilderState(app_state)


def _needs_vision(step: Step) -> bool:
    """Check if a step requires the AI vision model."""
    if step.action in ("click", "double_click", "right_click", "verify"):
        # Coordinate-based clicks don't need vision
        if step.click_x is not None and step.click_y is not None:
            return False
        return True
    return False


def execute_builder_step(step: Step, builder: BuilderState) -> dict:
    """Execute a single step in the builder and return the result with screenshot."""
    defn = registry.get(step.action)
    if defn is None:
        return {
            "passed": False,
            "error": f"Unknown step type: {step.action}",
            "screenshot_base64": None,
        }

    # Only load the AI model if this step actually needs it
    if _needs_vision(step):
        agent = builder.ensure_agent()
    else:
        agent = builder.agent  # may be None, but non-vision steps won't use it

    pre_click_b64 = None

    # Handle runner-level steps
    if defn.is_runner_step:
        runner_ctx = {
            "effective_settings": builder.settings,
            "agent": agent,
            "actions": builder.actions,
            "app_manager": builder.app_manager,
            "recovery": builder.recovery,
            "variables": None,
            "loop_counters": {},
            "current_step_index": 0,
        }
        try:
            result = defn.execute(step, runner_ctx)
        except Exception as e:
            result = StepResult(step=step, passed=False, error=str(e))
        builder.app_manager = runner_ctx.get("app_manager")
        builder.recovery = runner_ctx.get("recovery")
    else:
        if builder.app_manager:
            builder.app_manager.focus()

        # Coordinate-based clicks: capture pre-click screenshot with annotation
        if step.click_x is not None and step.click_y is not None:
            # Take screenshot BEFORE the click for the step preview
            pre_screenshot = builder.screen.capture()
            w, h = pre_screenshot.size
            px = int(step.click_x * w)
            py = int(step.click_y * h)

            # Annotate the pre-click screenshot
            import io
            from PIL import ImageDraw
            img = pre_screenshot.copy()
            draw = ImageDraw.Draw(img)
            r = 25
            draw.ellipse([(px - r, py - r), (px + r, py + r)], outline="red", width=3)
            draw.line([(px - r, py), (px + r, py)], fill="red", width=2)
            draw.line([(px, py - r), (px, py + r)], fill="red", width=2)
            arrow_len = 60
            draw.line([(px, py - r - arrow_len), (px, py - r)], fill="red", width=3)
            draw.polygon([(px, py - r), (px - 8, py - r - 12), (px + 8, py - r - 12)], fill="red")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            pre_click_b64 = base64.b64encode(buf.getvalue()).decode()

            if agent is None:
                agent = Agent(None, builder.screen, builder.actions)
                agent.report_dir = None
            result = agent.click_at(step, click_type=step.action if step.action in ("double_click", "right_click") else "click", restore_cursor=True)
        else:
            pre_click_b64 = None
            agent = builder.ensure_agent()
            step_timeout = step.timeout or builder.settings.timeout.step_timeout
            result = agent.execute_step(step, step_timeout=step_timeout)

    # For coordinate clicks, use the pre-click annotated screenshot as the step screenshot
    # and also capture a clean post-click screenshot for the viewer
    screenshot_b64 = None
    post_screenshot_b64 = None
    if pre_click_b64:
        screenshot_b64 = pre_click_b64
        # Capture clean post-click screenshot for the viewer
        try:
            import io
            post_img = builder.screen.capture()
            buf = io.BytesIO()
            post_img.save(buf, format="PNG")
            post_screenshot_b64 = base64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass
    else:
        try:
            import io
            from PIL import ImageDraw
            screenshot = builder.screen.capture()

            if result.coordinates:
                img = screenshot.copy()
                x, y = result.coordinates
                draw = ImageDraw.Draw(img)
                r = 25
                draw.ellipse([(x - r, y - r), (x + r, y + r)], outline="red", width=3)
                draw.line([(x - r, y), (x + r, y)], fill="red", width=2)
                draw.line([(x, y - r), (x, y + r)], fill="red", width=2)
                arrow_len = 60
                draw.line([(x, y - r - arrow_len), (x, y - r)], fill="red", width=3)
                draw.polygon([(x, y - r), (x - 8, y - r - 12), (x + 8, y - r - 12)], fill="red")
                screenshot = img

            buf = io.BytesIO()
            screenshot.save(buf, format="PNG")
            screenshot_b64 = base64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass

    # For click-based steps, mark as "needs_confirmation" so the UI
    # can show accept/retry buttons
    needs_confirmation = result.coordinates is not None

    return {
        "passed": result.passed,
        "error": result.error,
        "coordinates": list(result.coordinates) if result.coordinates else None,
        "model_response": result.model_response,
        "duration_seconds": round(result.duration_seconds, 2),
        "screenshot_base64": screenshot_b64,
        "post_screenshot_base64": post_screenshot_b64,
        "needs_confirmation": needs_confirmation,
    }
