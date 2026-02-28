"""Scroll step -- scroll the mouse wheel."""

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult


def validate(step, step_num):
    if step.scroll_amount == 0:
        return [f"Step {step_num}: 'scroll' requires a non-zero 'scroll_amount' value"]
    return []


def execute(step, agent):
    agent.actions.scroll(step.scroll_amount)
    return StepResult(step=step, passed=True)


definition = StepDefinition(
    name="scroll",
    description="Scroll the mouse wheel (positive=up, negative=down)",
    fields=[FieldDef("scroll_amount", "number", required=True)],
    validate=validate,
    execute=execute,
)
