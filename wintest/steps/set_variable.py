"""Set-variable step -- set a variable value during a test run."""

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult


def validate(step, step_num):
    issues = []
    if not step.variable_name:
        issues.append(f"Step {step_num}: 'set_variable' requires a 'variable_name' field")
    if step.variable_value is None:
        issues.append(f"Step {step_num}: 'set_variable' requires a 'variable_value' field")
    return issues


def execute(step, runner_ctx):
    """Execute in runner context to access the variable store."""
    variables = runner_ctx.get("variables")
    if variables is None:
        return StepResult(
            step=step, passed=False, error="Variable store not available"
        )
    variables.set(step.variable_name, step.variable_value)
    return StepResult(step=step, passed=True)


definition = StepDefinition(
    name="set_variable",
    description="Set a variable value for use in subsequent steps",
    fields=[
        FieldDef("variable_name", "string", required=True),
        FieldDef("variable_value", "string", required=True),
    ],
    validate=validate,
    execute=execute,
    is_runner_step=True,
)
