"""Service for browsing past test reports."""

import json
import shutil
from pathlib import Path

from ..models import ReportSummary

REPORTS_DIR = "reports"


def list_reports() -> list[ReportSummary]:
    """List all reports sorted by date descending."""
    reports_dir = Path(REPORTS_DIR)
    if not reports_dir.exists():
        return []

    summaries = []
    for report_dir in sorted(reports_dir.iterdir(), reverse=True):
        if not report_dir.is_dir():
            continue
        json_path = report_dir / "report.json"
        if not json_path.exists():
            continue
        try:
            with open(json_path) as f:
                data = json.load(f)
            summary = data.get("summary", {})
            summaries.append(ReportSummary(
                report_id=report_dir.name,
                test_name=data.get("test_name", data.get("task_name", "Unknown")),
                passed=data.get("passed", False),
                total=summary.get("total", 0),
                passed_count=summary.get("passed", 0),
                failed_count=summary.get("failed", 0),
                generated_at=data.get("generated_at", ""),
            ))
        except (json.JSONDecodeError, KeyError):
            continue

    return summaries


def get_report(report_id: str) -> dict:
    """Get full report JSON data."""
    json_path = _resolve_report(report_id) / "report.json"
    if not json_path.exists():
        raise FileNotFoundError(f"Report JSON not found: {report_id}")
    with open(json_path) as f:
        return json.load(f)


def get_screenshot_path(report_id: str, filename: str) -> Path:
    """Get the path to a screenshot file."""
    path = _resolve_report(report_id) / "screenshots" / filename
    if not path.exists():
        raise FileNotFoundError(f"Screenshot not found: {filename}")
    return path


def delete_report(report_id: str) -> None:
    """Delete a report directory and all its contents."""
    path = _resolve_report(report_id)
    shutil.rmtree(path)


def _resolve_report(report_id: str) -> Path:
    """Resolve a report_id to a directory path."""
    path = Path(REPORTS_DIR) / report_id
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"Report not found: {report_id}")
    return path
