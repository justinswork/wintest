"""Service for browsing past test reports."""

import json
import shutil
from pathlib import Path

from ....config import workspace
from ..models import ReportSummary


def list_reports() -> list[ReportSummary]:
    """List all reports sorted by date descending."""
    if not workspace.is_configured():
        return []
    reports_dir = workspace.reports_dir()
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
            duration = sum(
                s.get("duration_seconds", 0) for s in data.get("steps", [])
            )
            summaries.append(ReportSummary(
                report_id=report_dir.name,
                test_name=data.get("test_name", data.get("task_name", "Unknown")),
                passed=data.get("passed", False),
                total=summary.get("total", 0),
                passed_count=summary.get("passed", 0),
                failed_count=summary.get("failed", 0),
                generated_at=data.get("generated_at", ""),
                duration_seconds=round(duration, 2),
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


def export_pdf(report_id: str) -> Path:
    """Generate a PDF for a report. Returns the path to the PDF file."""
    from fpdf import FPDF

    report_dir = _resolve_report(report_id)
    json_path = report_dir / "report.json"
    if not json_path.exists():
        raise FileNotFoundError(f"Report JSON not found: {report_id}")

    with open(json_path) as f:
        data = json.load(f)

    test_name = data.get("test_name", "Unknown")
    passed = data.get("passed", False)
    summary = data.get("summary", {})
    generated_at = data.get("generated_at", "")
    steps = data.get("steps", [])

    def _safe(text: str) -> str:
        """Sanitize text for PDF — replace chars that Helvetica can't handle."""
        return text.encode('latin-1', 'replace').decode('latin-1')

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # -- Header --
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, _safe(test_name), new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "B", 12)
    if passed:
        pdf.set_text_color(34, 197, 94)
        pdf.cell(0, 8, "PASSED", new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.set_text_color(239, 68, 68)
        pdf.cell(0, 8, "FAILED", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(136, 136, 136)
    pdf.cell(0, 6, f"Generated {generated_at}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)

    # -- Summary --
    pdf.set_font("Helvetica", "B", 11)
    total = summary.get("total", 0)
    passed_count = summary.get("passed", 0)
    failed_count = summary.get("failed", 0)
    pdf.cell(40, 8, f"Total: {total}")
    pdf.set_text_color(34, 197, 94)
    pdf.cell(40, 8, f"Passed: {passed_count}")
    pdf.set_text_color(239, 68, 68)
    pdf.cell(40, 8, f"Failed: {failed_count}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    # Divider
    pdf.set_draw_color(220, 220, 220)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    # -- Steps --
    for i, step in enumerate(steps, 1):
        step_passed = step.get("passed", False)
        description = step.get("description") or step.get("action", "")
        action = step.get("action", "")
        duration = step.get("duration_seconds", 0)

        # Step header
        pdf.set_font("Helvetica", "B", 10)
        status_label = "PASS" if step_passed else "FAIL"
        if step_passed:
            pdf.set_text_color(34, 197, 94)
        else:
            pdf.set_text_color(239, 68, 68)
        pdf.cell(12, 7, status_label)
        pdf.set_text_color(0, 0, 0)

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(8, 7, f"#{i}")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, f"  {_safe(description)}  [{_safe(action)}]  {duration:.1f}s",
                 new_x="LMARGIN", new_y="NEXT")

        # Step details
        pdf.set_font("Helvetica", "", 9)
        target = step.get("target")
        if target:
            pdf.set_text_color(136, 136, 136)
            pdf.cell(20, 5, "Target:")
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 5, _safe(target), new_x="LMARGIN", new_y="NEXT")

        coords = step.get("coordinates")
        if coords:
            pdf.set_text_color(136, 136, 136)
            pdf.cell(20, 5, "Clicked at:")
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 5, f"({coords[0]}, {coords[1]})",
                     new_x="LMARGIN", new_y="NEXT")

        error = step.get("error")
        if error:
            pdf.set_text_color(239, 68, 68)
            pdf.set_font("Helvetica", "", 9)
            pdf.multi_cell(0, 5, f"Error: {_safe(error)}")
            pdf.set_text_color(0, 0, 0)

        model_response = step.get("model_response")
        if model_response:
            pdf.set_text_color(136, 136, 136)
            pdf.set_font("Helvetica", "", 8)
            pdf.multi_cell(0, 4, _safe(model_response))
            pdf.set_text_color(0, 0, 0)

        # Screenshot
        screenshot_path = step.get("screenshot_path")
        if screenshot_path:
            p = Path(screenshot_path)
            if p.exists():
                # Fit screenshot to page width with some margin
                img_width = pdf.w - 30
                pdf.ln(2)
                pdf.image(str(p), x=15, w=img_width)

        pdf.ln(4)

        # Light divider between steps
        pdf.set_draw_color(238, 238, 238)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(4)

    # -- Footer --
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(170, 170, 170)
    pdf.cell(0, 10, "Generated by wintest", align="C")

    pdf_path = report_dir / "report.pdf"
    pdf.output(str(pdf_path))
    return pdf_path


def _resolve_report(report_id: str) -> Path:
    """Resolve a report_id to a directory path."""
    path = workspace.reports_dir() / report_id
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"Report not found: {report_id}")
    return path
