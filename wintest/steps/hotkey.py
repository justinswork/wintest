"""Hotkey step -- press a key combination."""

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult


def validate(step, step_num):
    if not step.keys or len(step.keys) < 2:
        return [f"Step {step_num}: 'hotkey' requires a 'keys' list with at least 2 keys"]
    return []


def execute(step, agent):
    agent.actions.hotkey(*step.keys)
    return StepResult(step=step, passed=True)


definition = StepDefinition(
    name="hotkey",
    description="Press a key combination (ctrl+c, alt+f4, ...)",
    fields=[FieldDef("keys", "string[]", required=True)],
    validate=validate,
    execute=execute,
)
