"""Progress display callback for task execution."""

from ..tasks.schema import StepResult
from . import console


class ProgressDisplay:
    """Displays step-by-step progress during task execution."""

    def __init__(self, total_steps: int):
        self.total_steps = total_steps

    def on_step_start(self, step_num: int, label: str) -> None:
        """Called before a step begins execution."""
        console.info(f"\n  [{step_num}/{self.total_steps}] {label}...")

    def on_step_complete(self, step_num: int, result: StepResult) -> None:
        """Called after a step finishes. Prints colored PASS/FAIL."""
        label = result.step.description or result.step.action.value
        if result.passed:
            console.step_pass(
                step_num, self.total_steps, label, result.duration_seconds
            )
        else:
            console.step_fail(
                step_num, self.total_steps, label,
                result.duration_seconds, result.error or "",
            )
