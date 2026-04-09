import yaml
from .schema import TestDefinition, Step
from ..steps import registry


def load_test(filepath: str, settings=None) -> TestDefinition:
    """Load a test definition from a YAML file.

    Args:
        filepath: Path to the YAML test file.
        settings: Optional Settings instance for resolving defaults.
    """
    with open(filepath, "r") as f:
        data = yaml.safe_load(f)

    if "name" not in data:
        raise ValueError(f"Test file {filepath} missing required 'name' field")
    if "steps" not in data or not data["steps"]:
        raise ValueError(f"Test file {filepath} missing or empty 'steps' field")

    test_settings = data.get("settings", {})
    variables = data.get("variables", {})
    tags = data.get("tags", [])

    # Resolve retry defaults from Settings cascade or test YAML
    if settings:
        effective = settings.merge_test_settings(test_settings)
        default_retries = effective.retry.retry_attempts
        default_retry_delay = effective.retry.retry_delay
    else:
        default_retries = test_settings.get("retry_attempts", 3)
        default_retry_delay = test_settings.get("retry_delay", 2.0)

    steps = []
    for i, step_data in enumerate(data["steps"]):
        if "action" not in step_data:
            raise ValueError(f"Step {i + 1} missing required 'action' field")

        step_action = step_data["action"]
        if registry.get(step_action) is None:
            raise ValueError(
                f"Step {i + 1}: unknown action '{step_action}'. "
                f"Valid actions: {registry.action_names()}"
            )

        steps.append(Step(
            action=step_action,
            description=step_data.get("description", ""),
            target=step_data.get("target"),
            text=step_data.get("text"),
            key=step_data.get("key"),
            keys=step_data.get("keys"),
            scroll_amount=step_data.get("scroll_amount", 0),
            wait_seconds=step_data.get("wait_seconds", 0.0),
            app_path=step_data.get("app_path"),
            app_title=step_data.get("app_title"),
            expected=step_data.get("expected", True),
            retry_attempts=step_data.get("retry_attempts", default_retries),
            retry_delay=step_data.get("retry_delay", default_retry_delay),
            timeout=step_data.get("timeout"),
            variable_name=step_data.get("variable_name"),
            variable_value=step_data.get("variable_value"),
            loop_target=step_data.get("loop_target"),
            repeat=step_data.get("repeat", 0),
            click_x=step_data.get("click_x"),
            click_y=step_data.get("click_y"),
        ))

    return TestDefinition(
        name=data["name"],
        steps=steps,
        settings=test_settings,
        variables=variables,
        tags=tags,
    )
