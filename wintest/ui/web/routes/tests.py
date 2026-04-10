"""Test CRUD API routes."""

from fastapi import APIRouter, HTTPException, Request

from .. import state as state_module
from ..models import TestModel, TestListItem, ValidationResult, StepInfo
from ..services import test_service

router = APIRouter()


@router.get("", response_model=list[TestListItem])
async def list_tests():
    """List all test YAML files (including subfolders)."""
    settings = state_module.app_state.settings
    return test_service.list_tests(settings=settings)


@router.get("/steps", response_model=list[StepInfo])
async def list_step_types():
    """List all available step types."""
    return test_service.get_step_types()


@router.get("/file/{filepath:path}", response_model=TestModel)
async def get_test(filepath: str):
    """Get a test definition by filepath (supports subfolders)."""
    settings = state_module.app_state.settings
    try:
        return test_service.get_test(filepath, settings=settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Test not found: {filepath}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=dict)
async def create_test(test: TestModel):
    """Create a new test file."""
    filename = test_service.save_test(test)
    return {"filename": filename, "message": "Test created."}


@router.put("/file/{filepath:path}", response_model=dict)
async def update_test(filepath: str, test: TestModel):
    """Create or update a test file."""
    test_service.save_test(test, filename=filepath)
    return {"filename": filepath, "message": "Test saved."}


@router.delete("/file/{filepath:path}")
async def delete_test(filepath: str):
    """Delete a test file."""
    try:
        test_service.delete_test(filepath)
        return {"message": f"Deleted {filepath}"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Test not found: {filepath}")


@router.post("/file/{filepath:path}/validate", response_model=ValidationResult)
async def validate_test(filepath: str):
    """Validate a test file."""
    settings = state_module.app_state.settings
    try:
        return test_service.validate_test_file(filepath, settings=settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Test not found: {filepath}")
