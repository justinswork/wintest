"""Loader for test suite YAML files."""

import yaml

from .schema import TestSuiteDefinition


def load_test_suite(filepath: str) -> TestSuiteDefinition:
    """Load a test suite definition from a YAML file.

    Args:
        filepath: Path to the YAML suite file.
    """
    with open(filepath, "r") as f:
        data = yaml.safe_load(f)

    if "name" not in data:
        raise ValueError(f"Suite file {filepath} missing required 'name' field")
    if "tests" not in data or not data["tests"]:
        raise ValueError(f"Suite file {filepath} missing or empty 'tests' field")

    test_paths = []
    for i, entry in enumerate(data["tests"]):
        if isinstance(entry, str):
            test_paths.append(entry)
        elif isinstance(entry, dict) and "path" in entry:
            test_paths.append(entry["path"])
        else:
            raise ValueError(
                f"Suite file {filepath}: test entry {i + 1} must be a string "
                f"or an object with a 'path' field"
            )

    return TestSuiteDefinition(
        name=data["name"],
        description=data.get("description", ""),
        test_paths=test_paths,
        settings=data.get("settings", {}),
    )
