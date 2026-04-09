"""Double-click step -- double-click on a UI element or at explicit coordinates."""

from ._base import StepDefinition, FieldDef


def validate(step, step_num):
    if not step.target and step.click_x is None:
        return [f"Step {step_num}: 'double_click' requires a 'target' field or click_x/click_y coordinates"]
    return []


def execute(step, agent):
    if step.click_x is not None and step.click_y is not None:
        return agent.click_at(step, click_type="double_click")
    return agent.find_and_click(step, click_type="double_click")


definition = StepDefinition(
    name="double_click",
    description="Double-click on a UI element or at explicit coordinates",
    fields=[
        FieldDef("target", "string"),
        FieldDef("click_x", "number"),
        FieldDef("click_y", "number"),
    ],
    validate=validate,
    execute=execute,
)
