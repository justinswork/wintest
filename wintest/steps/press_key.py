"""Press-key step -- press a single keyboard key."""

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult


def validate(step, step_num):
    if not step.key:
        return [f"Step {step_num}: 'press_key' requires a 'key' field"]
    return []


def execute(step, agent):
    agent.actions.press_key(step.key)
    return StepResult(step=step, passed=True)


definition = StepDefinition(
    name="press_key",
    description="Press a single keyboard key (enter, tab, escape, ...)",
    fields=[FieldDef("key", "string", required=True)],
    validate=validate,
    execute=execute,
)
