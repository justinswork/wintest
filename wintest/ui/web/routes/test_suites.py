"""Test Suite CRUD API routes."""

from fastapi import APIRouter, HTTPException

from .. import state as state_module
from ..models import TestSuiteModel, TestSuiteListItem
from ..services import test_suite_service

router = APIRouter()


@router.get("", response_model=list[TestSuiteListItem])
async def list_suites():
    """List all test suites (including subfolders)."""
    return test_suite_service.list_suites()


@router.get("/file/{filepath:path}", response_model=TestSuiteModel)
async def get_suite(filepath: str):
    """Get a suite by filepath (supports subfolders)."""
    try:
        return test_suite_service.get_suite(filepath)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Suite not found: {filepath}")


@router.post("", response_model=dict)
async def create_suite(suite: TestSuiteModel):
    """Create a new suite."""
    filename = test_suite_service.save_suite(suite)
    return {"filename": filename}


@router.put("/file/{filepath:path}", response_model=dict)
async def update_suite(filepath: str, suite: TestSuiteModel):
    """Update an existing suite."""
    try:
        test_suite_service.get_suite(filepath)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Suite not found: {filepath}")
    test_suite_service.save_suite(suite, filename=filepath)
    return {"filename": filepath}


@router.delete("/file/{filepath:path}")
async def delete_suite(filepath: str):
    """Delete a suite."""
    try:
        test_suite_service.delete_suite(filepath)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Suite not found: {filepath}")
    return {"deleted": filepath}
