"""Click step -- click on a UI element identified by the AI model."""

from ._base import StepDefinition, FieldDef


def validate(step, step_num):
    if not step.target:
        return [f"Step {step_num}: 'click' requires a 'target' field"]
    return []


def execute(step, agent):
    return agent.find_and_click(step, click_type="click")


definition = StepDefinition(
    name="click",
    description="Click on a UI element identified by the AI model",
    fields=[FieldDef("target", "string", required=True)],
    validate=validate,
    execute=execute,
)
