"""Semantic validation for test YAML files beyond basic schema checks."""

from .schema import TestDefinition
from ..steps import registry


def validate_test(test: TestDefinition) -> list[str]:
    """
    Run semantic checks on a loaded TestDefinition.

    Returns a list of issue strings. Empty list means valid.
    The loader already guarantees structural validity, so this
    focuses on logical correctness.
    """
    issues = []

    for i, step in enumerate(test.steps, 1):
        defn = registry.get(step.action)
        if defn is None:
            issues.append(f"Step {i}: unknown step type '{step.action}'")
            continue
        issues.extend(defn.validate(step, i))

    return issues
