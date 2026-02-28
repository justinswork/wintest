"""Service for test file CRUD operations."""

import os
from pathlib import Path

import yaml

from ....tasks.loader import load_test
from ....tasks.validator import validate_test
from ....steps import registry
from ..models import TestModel, TestListItem, StepModel, ValidationResult, StepInfo, FieldInfo

TESTS_DIR = "tests"


def list_tests(settings=None) -> list[TestListItem]:
    """List all test YAML files in the tests directory."""
    tests_dir = Path(TESTS_DIR)
    if not tests_dir.exists():
        return []

    items = []
    for path in sorted(tests_dir.glob("*.yaml")):
        try:
            test = load_test(str(path), settings=settings)
            items.append(TestListItem(
                filename=path.name,
                name=test.name,
                step_count=len(test.steps),
            ))
        except (ValueError, Exception):
            items.append(TestListItem(
                filename=path.name,
                name=f"(invalid: {path.name})",
                step_count=0,
            ))
    return items


def get_test(filename: str, settings=None) -> TestModel:
    """Load a test file and return it as a TestModel."""
    path = _resolve_path(filename)
    test = load_test(str(path), settings=settings)

    steps = []
    for step in test.steps:
        steps.append(StepModel(
            action=step.action,
            description=step.description,
            target=step.target,
            text=step.text,
            key=step.key,
            keys=step.keys,
            scroll_amount=step.scroll_amount,
            wait_seconds=step.wait_seconds,
            expected=step.expected,
            retry_attempts=step.retry_attempts,
            retry_delay=step.retry_delay,
            timeout=step.timeout,
            app_path=step.app_path,
            app_title=step.app_title,
        ))

    return TestModel(
        name=test.name,
        filename=filename,
        steps=steps,
        settings=test.settings,
    )


def save_test(test: TestModel, filename: str | None = None) -> str:
    """Save a TestModel as a YAML file. Returns the filename."""
    if filename is None:
        filename = test.filename
    if filename is None:
        safe_name = test.name.lower().replace(" ", "_")
        filename = f"{safe_name}.yaml"

    data = {
        "name": test.name,
        "steps": [],
    }

    for step in test.steps:
        step_data = {"action": step.action}
        if step.description:
            step_data["description"] = step.description
        if step.target is not None:
            step_data["target"] = step.target
        if step.text is not None:
            step_data["text"] = step.text
        if step.key is not None:
            step_data["key"] = step.key
        if step.keys is not None:
            step_data["keys"] = step.keys
        if step.scroll_amount != 0:
            step_data["scroll_amount"] = step.scroll_amount
        if step.wait_seconds != 0.0:
            step_data["wait_seconds"] = step.wait_seconds
        if not step.expected:
            step_data["expected"] = step.expected
        if step.retry_attempts != 3:
            step_data["retry_attempts"] = step.retry_attempts
        if step.retry_delay != 2.0:
            step_data["retry_delay"] = step.retry_delay
        if step.timeout is not None:
            step_data["timeout"] = step.timeout
        if step.app_path is not None:
            step_data["app_path"] = step.app_path
        if step.app_title is not None:
            step_data["app_title"] = step.app_title
        data["steps"].append(step_data)

    if test.settings:
        data["settings"] = test.settings

    tests_dir = Path(TESTS_DIR)
    tests_dir.mkdir(exist_ok=True)
    path = tests_dir / filename

    # Atomic write
    tmp_path = path.with_suffix(".yaml.tmp")
    with open(tmp_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    os.replace(str(tmp_path), str(path))

    return filename


def delete_test(filename: str) -> None:
    """Delete a test file."""
    path = _resolve_path(filename)
    path.unlink()


def validate_test_file(filename: str, settings=None) -> ValidationResult:
    """Validate a test file structurally and semantically."""
    path = _resolve_path(filename)
    try:
        test = load_test(str(path), settings=settings)
    except ValueError as e:
        return ValidationResult(valid=False, issues=[str(e)])

    issues = validate_test(test)
    return ValidationResult(valid=len(issues) == 0, issues=issues)


def get_step_types() -> list[StepInfo]:
    """Return all available step types with descriptions from the action registry."""
    step_types = []
    for defn in registry.all_definitions():
        required = [f.name for f in defn.fields if f.required]
        fields = [
            FieldInfo(name=f.name, field_type=f.field_type, required=f.required)
            for f in defn.fields
        ]
        step_types.append(StepInfo(
            name=defn.name,
            description=defn.description,
            required_fields=required,
            fields=fields,
        ))
    return step_types


def _resolve_path(filename: str) -> Path:
    """Resolve a filename to a path in the tests directory."""
    path = Path(TESTS_DIR) / filename
    if not path.exists():
        raise FileNotFoundError(f"Test file not found: {filename}")
    return path
