"""Service for test suite file CRUD operations."""

import os
from pathlib import Path

import yaml

from ....tasks.test_suite_loader import load_test_suite
from ..models import TestSuiteModel, TestSuiteListItem

SUITES_DIR = "test_suites"
TESTS_DIR = "tests"


def list_suites() -> list[TestSuiteListItem]:
    """List all suite YAML files in the suites directory."""
    suites_dir = Path(SUITES_DIR)
    if not suites_dir.exists():
        return []

    items = []
    for path in sorted(suites_dir.rglob("*.yaml")):
        rel_path = path.relative_to(suites_dir).as_posix()
        try:
            suite = load_test_suite(str(path))
            items.append(TestSuiteListItem(
                filename=rel_path,
                name=suite.name,
                description=suite.description,
                test_count=len(suite.test_paths),
            ))
        except (ValueError, Exception):
            items.append(TestSuiteListItem(
                filename=rel_path,
                name=f"(invalid: {rel_path})",
                description="",
                test_count=0,
            ))
    return items


def get_suite(filename: str) -> TestSuiteModel:
    """Load a suite file and return it as a TestSuiteModel."""
    path = _resolve_path(filename)
    suite = load_test_suite(str(path))

    return TestSuiteModel(
        name=suite.name,
        filename=filename,
        description=suite.description,
        test_paths=suite.test_paths,
        settings=suite.settings,
    )


def save_suite(suite: TestSuiteModel, filename: str | None = None) -> str:
    """Save a TestSuiteModel as a YAML file. Returns the filename."""
    if filename is None:
        filename = suite.filename
    if filename is None:
        safe_name = suite.name.lower().replace(" ", "_")
        filename = f"{safe_name}.yaml"

    data = {
        "name": suite.name,
    }

    if suite.description:
        data["description"] = suite.description

    data["tests"] = [{"path": p} for p in suite.test_paths]

    if suite.settings:
        data["settings"] = suite.settings

    suites_dir = Path(SUITES_DIR)
    suites_dir.mkdir(exist_ok=True)
    path = suites_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = path.with_suffix(".yaml.tmp")
    with open(tmp_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    os.replace(str(tmp_path), str(path))

    return filename


def delete_suite(filename: str) -> None:
    """Delete a suite file."""
    path = _resolve_path(filename)
    path.unlink()


def _resolve_path(filename: str) -> Path:
    """Resolve a filename to a path in the suites directory."""
    path = Path(SUITES_DIR) / filename
    if not path.exists():
        raise FileNotFoundError(f"Suite file not found: {filename}")
    return path
