"""Launch-application step -- launch an app and manage its window.

This is a runner-level step: it needs access to the runner context
(app_manager, recovery strategy) rather than just the agent.
"""

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult
from ..core.app_manager import ApplicationManager, AppConfig
from ..core.recovery import RecoveryStrategy


def validate(step, step_num):
    if not step.app_path:
        return [f"Step {step_num}: 'launch_application' requires an 'app_path' field"]
    return []


def execute(step, runner_ctx):
    """Execute in runner context — runner_ctx has settings, agent, and state."""
    effective = runner_ctx["effective_settings"]
    app_config = AppConfig(
        path=step.app_path,
        title=step.app_title,
        wait_after_launch=step.wait_seconds or effective.app.wait_after_launch,
    )
    app_manager = ApplicationManager(
        config=app_config,
        graceful_close_timeout=effective.app.graceful_close_timeout,
        focus_delay=effective.app.focus_delay,
    )
    app_manager.launch()

    # Store on runner context so runner can focus/close it
    runner_ctx["app_manager"] = app_manager

    if effective.recovery.enabled:
        runner_ctx["recovery"] = RecoveryStrategy(
            app_manager=app_manager,
            actions=runner_ctx["agent"].actions,
            max_attempts=effective.recovery.max_recovery_attempts,
            dismiss_keys=effective.recovery.dismiss_dialog_keys,
            recovery_delay=effective.recovery.recovery_delay,
        )

    return StepResult(step=step, passed=True)


definition = StepDefinition(
    name="launch_application",
    description="Launch an application and manage its window",
    fields=[
        FieldDef("app_path", "string", required=True),
        FieldDef("app_title", "string"),
        FieldDef("wait_seconds", "number"),
    ],
    validate=validate,
    execute=execute,
    is_runner_step=True,
)
