"""Execution API routes."""

from fastapi import APIRouter, HTTPException

from .. import state as state_module
from ..models import RunRequest, RunResponse, RunStatus, ModelStatus, RunTestSuiteRequest, RunTestSuiteResponse
from ..services import execution_service

router = APIRouter()


@router.post("/run", response_model=RunResponse)
async def run_test(request: RunRequest):
    """Start a test run."""
    app_state = state_module.app_state
    try:
        result = execution_service.start_run(request.test_file, app_state)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Test file not found: {request.test_file}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result is None:
        run = app_state.current_run
        raise HTTPException(
            status_code=409,
            detail={
                "message": "A run is already in progress",
                "current_run_id": run.run_id if run else None,
                "test_name": run.test_name if run else None,
            },
        )

    return RunResponse(**result)


@router.post("/cancel")
async def cancel_run():
    """Cancel the current running test."""
    app_state = state_module.app_state
    cancelled = execution_service.cancel_run(app_state)
    if not cancelled:
        raise HTTPException(status_code=409, detail="No run is currently in progress")
    return {"status": "cancelling"}


@router.get("/status", response_model=RunStatus)
async def get_status():
    """Get current execution status."""
    app_state = state_module.app_state
    run = app_state.current_run or app_state.last_run

    if run is None:
        return RunStatus(status="idle")

    return RunStatus(
        run_id=run.run_id,
        status=run.status,
        test_name=run.test_name,
        current_step=run.current_step,
        total_steps=run.total_steps,
        step_results=run.step_results,
    )


@router.get("/model-status", response_model=ModelStatus)
async def get_model_status():
    """Get the model load state."""
    return ModelStatus(status=state_module.app_state.model_status)


@router.post("/load-model")
async def load_model():
    """Pre-load the AI model without running a test."""
    app_state = state_module.app_state
    if app_state.model_status == "loaded":
        return {"status": "already_loaded"}
    if app_state.model_status == "loading":
        return {"status": "loading"}

    execution_service.load_model(app_state)
    return {"status": "loading"}


@router.post("/run-test-suite", response_model=RunTestSuiteResponse)
async def run_test_suite(request: RunTestSuiteRequest):
    """Start a test suite run."""
    app_state = state_module.app_state
    try:
        result = execution_service.start_test_suite_run(request.suite_file, app_state)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Suite file not found: {request.suite_file}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if result is None:
        run = app_state.current_run
        raise HTTPException(
            status_code=409,
            detail={
                "message": "A run is already in progress",
                "current_run_id": run.run_id if run else None,
                "test_name": run.test_name if run else None,
            },
        )

    return RunTestSuiteResponse(**result)
