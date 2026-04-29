"""Click step -- click at explicit coordinates.

Click types: click (left), double_click, right_click, middle_click. For
clicks that locate the target by natural-language description (AI), use
the click_element step instead.
"""

from ._base import StepDefinition, FieldDef


def validate(step, step_num):
    if step.click_x is None or step.click_y is None:
        return [f"Step {step_num}: 'click' requires click_x and click_y coordinates"]
    if step.click_type not in ("click", "double_click", "right_click", "middle_click"):
        return [f"Step {step_num}: invalid click_type '{step.click_type}'"]
    return []


def execute(step, agent):
    return agent.click_at(step, click_type=step.click_type or "click")


definition = StepDefinition(
    name="click",
    description="Click at coordinates (left, double, right, or middle click)",
    fields=[
        FieldDef("click_x", "number", required=True),
        FieldDef("click_y", "number", required=True),
        FieldDef("click_type", "string"),
    ],
    validate=validate,
    execute=execute,
)
