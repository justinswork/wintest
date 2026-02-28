"""Type step -- type text at the current cursor position."""

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult


def validate(step, step_num):
    if not step.text:
        return [f"Step {step_num}: 'type' requires a 'text' field"]
    return []


def execute(step, agent):
    agent.actions.type_text(step.text)
    return StepResult(step=step, passed=True)


definition = StepDefinition(
    name="type",
    description="Type text at the current cursor position",
    fields=[FieldDef("text", "string", required=True)],
    validate=validate,
    execute=execute,
)
