"""Double-click step -- double-click on a UI element."""

from ._base import StepDefinition, FieldDef


def validate(step, step_num):
    if not step.target:
        return [f"Step {step_num}: 'double_click' requires a 'target' field"]
    return []


def execute(step, agent):
    return agent.find_and_click(step, click_type="double_click")


definition = StepDefinition(
    name="double_click",
    description="Double-click on a UI element",
    fields=[FieldDef("target", "string", required=True)],
    validate=validate,
    execute=execute,
)
