"""Click-element step -- locate a UI element by natural-language description and click it.

Uses the vision model to find the target on the current screen, then clicks
it. For clicks at known coordinates, use the regular click step instead.
"""

from ._base import StepDefinition, FieldDef


def validate(step, step_num):
    if not step.target:
        return [f"Step {step_num}: 'click_element' requires a 'target' field"]
    if step.click_type not in ("click", "double_click", "right_click", "middle_click"):
        return [f"Step {step_num}: invalid click_type '{step.click_type}'"]
    return []


def execute(step, agent):
    return agent.find_and_click(step, click_type=step.click_type or "click")


definition = StepDefinition(
    name="click_element",
    description="Locate a UI element by description and click it (uses the vision model)",
    fields=[
        FieldDef("target", "string", required=True),
        FieldDef("click_type", "string"),
    ],
    validate=validate,
    execute=execute,
    requires_vision=True,
)
