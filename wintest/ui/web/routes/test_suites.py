"""Test Suite CRUD API routes."""

from fastapi import APIRouter, HTTPException

from .. import state as state_module
from ..models import TestSuiteModel, TestSuiteListItem
from ..services import test_suite_service

router = APIRouter()


@router.get("", response_model=list[TestSuiteListItem])
async def list_suites():
    """List all test suites."""
    return test_suite_service.list_suites()


@router.get("/{filename}", response_model=TestSuiteModel)
async def get_suite(filename: str):
    """Get a suite by filename."""
    try:
        return test_suite_service.get_suite(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Suite not found: {filename}")


@router.post("", response_model=dict)
async def create_suite(suite: TestSuiteModel):
    """Create a new suite."""
    filename = test_suite_service.save_suite(suite)
    return {"filename": filename}


@router.put("/{filename}", response_model=dict)
async def update_suite(filename: str, suite: TestSuiteModel):
    """Update an existing suite."""
    try:
        test_suite_service.get_suite(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Suite not found: {filename}")
    test_suite_service.save_suite(suite, filename=filename)
    return {"filename": filename}


@router.delete("/{filename}")
async def delete_suite(filename: str):
    """Delete a suite."""
    try:
        test_suite_service.delete_suite(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Suite not found: {filename}")
    return {"deleted": filename}
