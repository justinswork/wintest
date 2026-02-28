"""Semantic validation for task YAML files beyond basic schema checks."""

from .schema import ActionType, TaskDefinition


def validate_task(task: TaskDefinition) -> list[str]:
    """
    Run semantic checks on a loaded TaskDefinition.

    Returns a list of issue strings. Empty list means valid.
    The loader already guarantees structural validity, so this
    focuses on logical correctness.
    """
    issues = []

    for i, step in enumerate(task.steps, 1):
        if step.action in (
            ActionType.CLICK, ActionType.DOUBLE_CLICK,
            ActionType.RIGHT_CLICK, ActionType.VERIFY,
        ):
            if not step.target:
                issues.append(
                    f"Step {i}: '{step.action.value}' requires a 'target' field"
                )

        if step.action == ActionType.TYPE and not step.text:
            issues.append(f"Step {i}: 'type' requires a 'text' field")

        if step.action == ActionType.PRESS_KEY and not step.key:
            issues.append(f"Step {i}: 'press_key' requires a 'key' field")

        if step.action == ActionType.HOTKEY:
            if not step.keys or len(step.keys) < 2:
                issues.append(
                    f"Step {i}: 'hotkey' requires a 'keys' list with at least 2 keys"
                )

        if step.action == ActionType.WAIT and step.wait_seconds <= 0:
            issues.append(
                f"Step {i}: 'wait' requires a positive 'wait_seconds' value"
            )

        if step.action == ActionType.SCROLL and step.scroll_amount == 0:
            issues.append(
                f"Step {i}: 'scroll' requires a non-zero 'scroll_amount' value"
            )

    if task.application and "path" not in task.application:
        issues.append("Application config is missing required 'path' field")

    return issues
