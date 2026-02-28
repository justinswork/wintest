"""Verify step -- verify that a UI element is visible (or not visible)."""

from ._base import StepDefinition, FieldDef


def validate(step, step_num):
    if not step.target:
        return [f"Step {step_num}: 'verify' requires a 'target' field"]
    return []


def execute(step, agent):
    return agent.find_and_verify(step)


definition = StepDefinition(
    name="verify",
    description="Verify that a UI element is visible (or not visible)",
    fields=[
        FieldDef("target", "string", required=True),
    ],
    validate=validate,
    execute=execute,
)
