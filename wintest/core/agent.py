import logging
import os
import threading
import time

from PIL import ImageDraw

from ..tasks.schema import Step, StepResult, ActionType
from .vision import VisionModel
from .screen import ScreenCapture
from .actions import ActionExecutor

logger = logging.getLogger(__name__)


class Agent:
    """
    Executes test steps by combining vision, screen capture, and actions.

    For vision-based steps (click, verify): screenshots the screen, asks the
    model to locate the target element, then performs the action.
    """

    def __init__(
        self,
        vision: VisionModel,
        screen: ScreenCapture,
        actions: ActionExecutor,
        report_dir: str = None,
    ):
        self.vision = vision
        self.screen = screen
        self.actions = actions
        self.report_dir = report_dir
        self._step_counter = 0

    def execute_step(self, step: Step, step_timeout: float = 60.0) -> StepResult:
        """Execute a single test step with timeout enforcement."""
        self._step_counter += 1
        start = time.time()

        result_box = [None]
        error_box = [None]

        def _run():
            try:
                result_box[0] = self._dispatch(step)
            except Exception as e:
                error_box[0] = e

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        thread.join(timeout=step_timeout)

        if thread.is_alive():
            logger.error("Step timed out after %.1fs", step_timeout)
            result = StepResult(
                step=step,
                passed=False,
                error=f"Step timed out after {step_timeout:.1f}s",
            )
        elif error_box[0] is not None:
            result = StepResult(
                step=step, passed=False, error=str(error_box[0])
            )
        else:
            result = result_box[0]

        result.duration_seconds = time.time() - start
        return result

    def _dispatch(self, step: Step) -> StepResult:
        """Route a step to the appropriate handler."""
        if step.action == ActionType.WAIT:
            self.actions.wait(step.wait_seconds)
            return StepResult(step=step, passed=True)

        if step.action == ActionType.TYPE:
            self.actions.type_text(step.text)
            return StepResult(step=step, passed=True)

        if step.action == ActionType.PRESS_KEY:
            self.actions.press_key(step.key)
            return StepResult(step=step, passed=True)

        if step.action == ActionType.HOTKEY:
            self.actions.hotkey(*step.keys)
            return StepResult(step=step, passed=True)

        if step.action == ActionType.SCROLL:
            self.actions.scroll(step.scroll_amount)
            return StepResult(step=step, passed=True)

        if step.action == ActionType.VERIFY:
            return self._execute_verify(step)

        if step.action in (
            ActionType.CLICK, ActionType.DOUBLE_CLICK, ActionType.RIGHT_CLICK
        ):
            return self._execute_click(step)

        return StepResult(
            step=step, passed=False, error=f"Unknown action: {step.action}"
        )

    def _execute_click(self, step: Step) -> StepResult:
        """Find an element on screen and click it, with retries."""
        for attempt in range(step.retry_attempts):
            screenshot = self.screen.capture()
            result = self.vision.find_element(screenshot, step.target)
            coords = result["coordinates"]

            if coords is not None:
                px, py = self.screen.normalized_to_pixel(*coords)

                # Save annotated screenshot with crosshair at click location
                screenshot_path = self._save_screenshot(
                    screenshot, click_coords=(px, py)
                )

                if step.action == ActionType.CLICK:
                    self.actions.click(px, py)
                elif step.action == ActionType.DOUBLE_CLICK:
                    self.actions.click(px, py, clicks=2)
                elif step.action == ActionType.RIGHT_CLICK:
                    self.actions.click(px, py, button="right")

                return StepResult(
                    step=step,
                    passed=True,
                    coordinates=(px, py),
                    model_response=result["raw_response"],
                    screenshot_path=screenshot_path,
                )

            if attempt < step.retry_attempts - 1:
                logger.info(
                    "  Retry %d/%d: '%s' not found, waiting %.1fs...",
                    attempt + 1, step.retry_attempts,
                    step.target, step.retry_delay,
                )
                time.sleep(step.retry_delay)

        # Save the last screenshot even on failure
        screenshot_path = self._save_screenshot(screenshot)

        return StepResult(
            step=step,
            passed=False,
            error=f"Element '{step.target}' not found after {step.retry_attempts} attempts",
            model_response=result["raw_response"],
            screenshot_path=screenshot_path,
        )

    def _execute_verify(self, step: Step) -> StepResult:
        """
        Verify whether an element is visible on screen.

        Uses find_element (same as click) — if coordinates are returned,
        the element is considered visible.
        """
        for attempt in range(step.retry_attempts):
            screenshot = self.screen.capture()
            result = self.vision.find_element(screenshot, step.target)
            is_visible = result["coordinates"] is not None

            if is_visible == step.expected:
                screenshot_path = self._save_screenshot(screenshot)
                return StepResult(
                    step=step,
                    passed=True,
                    model_response=result["raw_response"],
                    screenshot_path=screenshot_path,
                )

            if attempt < step.retry_attempts - 1:
                logger.info(
                    "  Retry %d/%d: verification pending, waiting %.1fs...",
                    attempt + 1, step.retry_attempts, step.retry_delay,
                )
                time.sleep(step.retry_delay)

        screenshot_path = self._save_screenshot(screenshot)
        expected_str = "visible" if step.expected else "not visible"
        return StepResult(
            step=step,
            passed=False,
            error=f"Expected '{step.target}' to be {expected_str}",
            model_response=result["raw_response"],
            screenshot_path=screenshot_path,
        )

    def _save_screenshot(self, screenshot, click_coords=None) -> str | None:
        """Save a screenshot to the report directory, optionally with a click annotation."""
        if not self.report_dir:
            return None

        screenshots_dir = os.path.join(self.report_dir, "screenshots")
        os.makedirs(screenshots_dir, exist_ok=True)

        img = screenshot.copy()

        if click_coords:
            self._draw_crosshair(img, *click_coords)

        path = os.path.join(screenshots_dir, f"step_{self._step_counter}.png")
        img.save(path)
        return path

    @staticmethod
    def _draw_crosshair(img, x, y, size=30, color="red", width=2):
        """Draw a crosshair and circle annotation at the click location."""
        draw = ImageDraw.Draw(img)
        # Crosshair lines
        draw.line([(x - size, y), (x + size, y)], fill=color, width=width)
        draw.line([(x, y - size), (x, y + size)], fill=color, width=width)
        # Circle around click point
        r = size // 2
        draw.ellipse(
            [(x - r, y - r), (x + r, y + r)], outline=color, width=width
        )
