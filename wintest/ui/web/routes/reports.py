"""Report API routes."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..models import ReportSummary
from ..services import report_service

router = APIRouter()


@router.get("", response_model=list[ReportSummary])
async def list_reports():
    """List all past reports."""
    return report_service.list_reports()


@router.get("/{report_id}")
async def get_report(report_id: str):
    """Get full report data."""
    try:
        return report_service.get_report(report_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Report not found: {report_id}")


@router.delete("/{report_id}")
async def delete_report(report_id: str):
    """Delete a report and its screenshots."""
    try:
        report_service.delete_report(report_id)
        return {"message": f"Deleted {report_id}"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Report not found: {report_id}")


@router.get("/{report_id}/pdf")
async def export_pdf(report_id: str):
    """Export a report as a PDF file."""
    try:
        path = report_service.export_pdf(report_id)
        return FileResponse(
            str(path),
            media_type="application/pdf",
            filename=f"{report_id}.pdf",
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Report not found: {report_id}")


@router.get("/{report_id}/screenshots/{filename}")
async def get_screenshot(report_id: str, filename: str):
    """Serve a screenshot image."""
    try:
        path = report_service.get_screenshot_path(report_id, filename)
        return FileResponse(str(path), media_type="image/png")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Screenshot not found")
