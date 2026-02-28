"""Test CRUD API routes."""

from fastapi import APIRouter, HTTPException

from .. import state as state_module
from ..models import TestModel, TestListItem, ValidationResult, StepInfo
from ..services import test_service

router = APIRouter()


@router.get("", response_model=list[TestListItem])
async def list_tests():
    """List all test YAML files."""
    settings = state_module.app_state.settings
    return test_service.list_tests(settings=settings)


@router.get("/steps", response_model=list[StepInfo])
async def list_step_types():
    """List all available step types."""
    return test_service.get_step_types()


@router.get("/{filename}", response_model=TestModel)
async def get_test(filename: str):
    """Get a test definition by filename."""
    settings = state_module.app_state.settings
    try:
        return test_service.get_test(filename, settings=settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Test not found: {filename}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=dict)
async def create_test(test: TestModel):
    """Create a new test file."""
    filename = test_service.save_test(test)
    return {"filename": filename, "message": "Test created."}


@router.put("/{filename}", response_model=dict)
async def update_test(filename: str, test: TestModel):
    """Create or update a test file."""
    test_service.save_test(test, filename=filename)
    return {"filename": filename, "message": "Test saved."}


@router.delete("/{filename}")
async def delete_test(filename: str):
    """Delete a test file."""
    try:
        test_service.delete_test(filename)
        return {"message": f"Deleted {filename}"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Test not found: {filename}")


@router.post("/{filename}/validate", response_model=ValidationResult)
async def validate_test(filename: str):
    """Validate a test file."""
    settings = state_module.app_state.settings
    try:
        return test_service.validate_test_file(filename, settings=settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Test not found: {filename}")
