"""Tests for web service modules: test_service, test_suite_service, report_service."""

import json
from pathlib import Path
import pytest

from wintest.config import workspace
from wintest.ui.web.models import TestModel, StepModel, TestSuiteModel
from wintest.ui.web.services import test_service, test_suite_service, report_service


@pytest.fixture
def tests_dir(tmp_path, monkeypatch):
    """Point workspace.tests_dir at a temp directory."""
    d = tmp_path / "tests"
    d.mkdir()
    monkeypatch.setattr(workspace, "_workspace_root", tmp_path)
    return d


@pytest.fixture
def suites_dir(tmp_path, monkeypatch):
    """Point workspace.suites_dir at a temp directory."""
    d = tmp_path / "test_suites"
    d.mkdir()
    monkeypatch.setattr(workspace, "_workspace_root", tmp_path)
    return d


@pytest.fixture
def reports_dir(tmp_path, monkeypatch):
    """Point workspace.reports_dir at a temp directory."""
    d = tmp_path / "reports"
    d.mkdir()
    monkeypatch.setattr(workspace, "_workspace_root", tmp_path)
    return d


# --- test_service ---

class TestTestServiceList:
    def test_empty_directory(self, tests_dir):
        assert test_service.list_tests() == []

    def test_lists_valid_test(self, tests_dir):
        (tests_dir / "my_test.yaml").write_text(
            "name: My Test\n"
            "steps:\n"
            "  - action: click\n"
            "    target: OK\n"
        )
        items = test_service.list_tests()
        assert len(items) == 1
        assert items[0].filename == "my_test.yaml"
        assert items[0].name == "My Test"
        assert items[0].step_count == 1

    def test_invalid_yaml_gracefully_handled(self, tests_dir):
        (tests_dir / "bad.yaml").write_text("not: valid: yaml: [")
        items = test_service.list_tests()
        assert len(items) == 1
        assert "(invalid:" in items[0].name

    def test_missing_directory(self, tmp_path, monkeypatch):
        monkeypatch.setattr(workspace, "_workspace_root", tmp_path / "nonexistent")
        assert test_service.list_tests() == []


class TestTestServiceCrud:
    def test_save_and_get_roundtrip(self, tests_dir):
        model = TestModel(
            name="Roundtrip",
            steps=[StepModel(action="click", target="OK")],
        )
        filename = test_service.save_test(model, "roundtrip.yaml")
        assert filename == "roundtrip.yaml"
        assert (tests_dir / "roundtrip.yaml").exists()

        loaded = test_service.get_test("roundtrip.yaml")
        assert loaded.name == "Roundtrip"
        assert len(loaded.steps) == 1
        assert loaded.steps[0].action == "click"
        assert loaded.steps[0].target == "OK"

    def test_save_auto_filename(self, tests_dir):
        model = TestModel(name="My Cool Test", steps=[StepModel(action="wait", wait_seconds=1)])
        filename = test_service.save_test(model)
        assert filename == "my_cool_test.yaml"

    def test_save_omits_defaults(self, tests_dir):
        model = TestModel(
            name="Defaults",
            steps=[StepModel(action="click", target="OK")],
        )
        test_service.save_test(model, "defaults.yaml")
        content = (tests_dir / "defaults.yaml").read_text()
        assert "scroll_amount" not in content
        assert "wait_seconds" not in content
        assert "expected" not in content  # True is default, omitted
        assert "retry_attempts" not in content
        assert "retry_delay" not in content

    def test_save_includes_non_defaults(self, tests_dir):
        model = TestModel(
            name="NonDefaults",
            steps=[StepModel(
                action="click",
                target="OK",
                expected=False,
                retry_attempts=5,
                scroll_amount=3,
            )],
        )
        test_service.save_test(model, "nd.yaml")
        content = (tests_dir / "nd.yaml").read_text()
        assert "expected: false" in content
        assert "retry_attempts: 5" in content
        assert "scroll_amount: 3" in content

    def test_save_no_tmp_file_left(self, tests_dir):
        model = TestModel(name="T", steps=[StepModel(action="wait", wait_seconds=1)])
        test_service.save_test(model, "t.yaml")
        assert not (tests_dir / "t.yaml.tmp").exists()

    def test_delete_test(self, tests_dir):
        (tests_dir / "del.yaml").write_text("name: Del\nsteps:\n  - action: wait\n    wait_seconds: 1\n")
        test_service.delete_test("del.yaml")
        assert not (tests_dir / "del.yaml").exists()

    def test_get_nonexistent_raises(self, tests_dir):
        with pytest.raises(FileNotFoundError):
            test_service.get_test("nonexistent.yaml")

    def test_delete_nonexistent_raises(self, tests_dir):
        with pytest.raises(FileNotFoundError):
            test_service.delete_test("nonexistent.yaml")


class TestTestServiceValidation:
    def test_valid_file(self, tests_dir):
        (tests_dir / "ok.yaml").write_text(
            "name: OK\nsteps:\n  - action: click_element\n    target: OK\n"
        )
        result = test_service.validate_test_file("ok.yaml")
        assert result.valid is True
        assert result.issues == []

    def test_invalid_file(self, tests_dir):
        (tests_dir / "bad.yaml").write_text(
            "name: Bad\nsteps:\n  - action: click_element\n"  # missing target
        )
        result = test_service.validate_test_file("bad.yaml")
        assert result.valid is False
        assert len(result.issues) == 1


class TestTestServiceStepTypes:
    def test_get_step_types(self):
        types = test_service.get_step_types()
        names = {t.name for t in types}
        assert "click" in names
        assert "type" in names
        assert "verify" in names

    def test_click_fields(self):
        types = test_service.get_step_types()
        click_info = next(t for t in types if t.name == "click")
        field_names = [f.name for f in click_info.fields]
        assert "click_x" in field_names
        assert "click_y" in field_names

    def test_click_element_fields(self):
        types = test_service.get_step_types()
        click_element_info = next(t for t in types if t.name == "click_element")
        field_names = [f.name for f in click_element_info.fields]
        assert "target" in field_names
        assert click_element_info.requires_vision is True

    def test_verify_requires_vision(self):
        types = test_service.get_step_types()
        verify_info = next(t for t in types if t.name == "verify")
        assert verify_info.requires_vision is True

    def test_click_does_not_require_vision(self):
        types = test_service.get_step_types()
        click_info = next(t for t in types if t.name == "click")
        assert click_info.requires_vision is False


# --- test_suite_service ---

class TestSuiteServiceList:
    def test_empty_directory(self, suites_dir):
        assert test_suite_service.list_suites() == []

    def test_lists_valid_suite(self, suites_dir):
        (suites_dir / "suite.yaml").write_text(
            "name: My Suite\ntests:\n  - a.yaml\n  - b.yaml\n"
        )
        items = test_suite_service.list_suites()
        assert len(items) == 1
        assert items[0].name == "My Suite"
        assert items[0].test_count == 2

    def test_missing_directory(self, tmp_path, monkeypatch):
        monkeypatch.setattr(workspace, "_workspace_root", tmp_path / "nonexistent")
        assert test_suite_service.list_suites() == []


class TestSuiteServiceCrud:
    def test_save_and_get_roundtrip(self, suites_dir):
        model = TestSuiteModel(
            name="Suite",
            description="A suite",
            test_paths=["a.yaml", "b.yaml"],
        )
        filename = test_suite_service.save_suite(model, "suite.yaml")
        loaded = test_suite_service.get_suite("suite.yaml")
        assert loaded.name == "Suite"
        assert loaded.description == "A suite"
        assert loaded.test_paths == ["a.yaml", "b.yaml"]

    def test_save_auto_filename(self, suites_dir):
        model = TestSuiteModel(name="My Suite", test_paths=["a.yaml"])
        filename = test_suite_service.save_suite(model)
        assert filename == "my_suite.yaml"

    def test_delete_suite(self, suites_dir):
        (suites_dir / "del.yaml").write_text("name: Del\ntests:\n  - a.yaml\n")
        test_suite_service.delete_suite("del.yaml")
        assert not (suites_dir / "del.yaml").exists()

    def test_get_nonexistent_raises(self, suites_dir):
        with pytest.raises(FileNotFoundError):
            test_suite_service.get_suite("nonexistent.yaml")


# --- report_service ---

def _create_report(reports_dir, report_id, data):
    """Helper to create a fake report directory with report.json."""
    report_dir = reports_dir / report_id
    report_dir.mkdir()
    (report_dir / "report.json").write_text(json.dumps(data))
    return report_dir


class TestReportServiceList:
    def test_empty_directory(self, reports_dir):
        assert report_service.list_reports() == []

    def test_missing_directory(self, tmp_path, monkeypatch):
        monkeypatch.setattr(workspace, "_workspace_root", tmp_path / "nonexistent")
        assert report_service.list_reports() == []

    def test_lists_valid_report(self, reports_dir):
        _create_report(reports_dir, "2026-01-01_120000_Test", {
            "test_name": "My Test",
            "passed": True,
            "summary": {"total": 3, "passed": 3, "failed": 0},
            "generated_at": "2026-01-01T12:00:00",
        })
        reports = report_service.list_reports()
        assert len(reports) == 1
        assert reports[0].test_name == "My Test"
        assert reports[0].passed is True
        assert reports[0].total == 3
        assert reports[0].passed_count == 3
        assert reports[0].failed_count == 0

    def test_legacy_task_name_field(self, reports_dir):
        """Reports with 'task_name' instead of 'test_name' still work."""
        _create_report(reports_dir, "2026-01-01_120000_Legacy", {
            "task_name": "Legacy Test",
            "passed": False,
            "summary": {"total": 1, "passed": 0, "failed": 1},
            "generated_at": "2026-01-01",
        })
        reports = report_service.list_reports()
        assert reports[0].test_name == "Legacy Test"

    def test_malformed_json_skipped(self, reports_dir):
        report_dir = reports_dir / "2026-01-01_bad"
        report_dir.mkdir()
        (report_dir / "report.json").write_text("{invalid json")
        assert report_service.list_reports() == []

    def test_dir_without_report_json_skipped(self, reports_dir):
        (reports_dir / "empty_dir").mkdir()
        assert report_service.list_reports() == []

    def test_sorted_by_date_descending(self, reports_dir):
        _create_report(reports_dir, "2026-01-01_000000_A", {
            "test_name": "A", "passed": True,
            "summary": {"total": 1, "passed": 1, "failed": 0},
            "generated_at": "2026-01-01",
        })
        _create_report(reports_dir, "2026-02-01_000000_B", {
            "test_name": "B", "passed": True,
            "summary": {"total": 1, "passed": 1, "failed": 0},
            "generated_at": "2026-02-01",
        })
        reports = report_service.list_reports()
        assert reports[0].test_name == "B"  # newer first
        assert reports[1].test_name == "A"


class TestReportServiceGet:
    def test_get_report(self, reports_dir):
        data = {"test_name": "T", "passed": True, "summary": {}, "generated_at": ""}
        _create_report(reports_dir, "2026-01-01_test", data)
        result = report_service.get_report("2026-01-01_test")
        assert result["test_name"] == "T"

    def test_get_nonexistent_raises(self, reports_dir):
        with pytest.raises(FileNotFoundError):
            report_service.get_report("nonexistent")

    def test_get_screenshot_nonexistent_raises(self, reports_dir):
        _create_report(reports_dir, "2026-01-01_test", {})
        (reports_dir / "2026-01-01_test" / "screenshots").mkdir()
        with pytest.raises(FileNotFoundError):
            report_service.get_screenshot_path("2026-01-01_test", "missing.png")


class TestReportServiceDelete:
    def test_delete_report(self, reports_dir):
        _create_report(reports_dir, "2026-01-01_del", {"test_name": "T"})
        report_service.delete_report("2026-01-01_del")
        assert not (reports_dir / "2026-01-01_del").exists()

    def test_delete_nonexistent_raises(self, reports_dir):
        with pytest.raises(FileNotFoundError):
            report_service.delete_report("nonexistent")
