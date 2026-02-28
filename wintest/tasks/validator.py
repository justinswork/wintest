"""Semantic validation for task YAML files beyond basic schema checks."""

from .schema import TaskDefinition
from ..steps import registry


def validate_task(task: TaskDefinition) -> list[str]:
    """
    Run semantic checks on a loaded TaskDefinition.

    Returns a list of issue strings. Empty list means valid.
    The loader already guarantees structural validity, so this
    focuses on logical correctness.
    """
    issues = []

    for i, step in enumerate(task.steps, 1):
        defn = registry.get(step.action)
        if defn is None:
            issues.append(f"Step {i}: unknown action '{step.action}'")
            continue
        issues.extend(defn.validate(step, i))

    return issues
