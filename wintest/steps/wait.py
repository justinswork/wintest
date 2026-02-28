"""Wait step -- pause execution for a specified duration."""

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult


def validate(step, step_num):
    if step.wait_seconds <= 0:
        return [f"Step {step_num}: 'wait' requires a positive 'wait_seconds' value"]
    return []


def execute(step, agent):
    agent.actions.wait(step.wait_seconds)
    return StepResult(step=step, passed=True)


definition = StepDefinition(
    name="wait",
    description="Pause execution for a specified duration",
    fields=[FieldDef("wait_seconds", "number", required=True)],
    validate=validate,
    execute=execute,
)
