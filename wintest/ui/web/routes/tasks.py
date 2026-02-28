"""Task CRUD API routes."""

from fastapi import APIRouter, HTTPException

from .. import state as state_module
from ..models import TaskModel, TaskListItem, ValidationResult, ActionInfo
from ..services import task_service

router = APIRouter()


@router.get("", response_model=list[TaskListItem])
async def list_tasks():
    """List all task YAML files."""
    settings = state_module.app_state.settings
    return task_service.list_tasks(settings=settings)


@router.get("/actions", response_model=list[ActionInfo])
async def list_actions():
    """List all available action types."""
    return task_service.get_action_types()


@router.get("/{filename}", response_model=TaskModel)
async def get_task(filename: str):
    """Get a task definition by filename."""
    settings = state_module.app_state.settings
    try:
        return task_service.get_task(filename, settings=settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Task not found: {filename}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=dict)
async def create_task(task: TaskModel):
    """Create a new task file."""
    filename = task_service.save_task(task)
    return {"filename": filename, "message": "Task created."}


@router.put("/{filename}", response_model=dict)
async def update_task(filename: str, task: TaskModel):
    """Create or update a task file."""
    task_service.save_task(task, filename=filename)
    return {"filename": filename, "message": "Task saved."}


@router.delete("/{filename}")
async def delete_task(filename: str):
    """Delete a task file."""
    try:
        task_service.delete_task(filename)
        return {"message": f"Deleted {filename}"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Task not found: {filename}")


@router.post("/{filename}/validate", response_model=ValidationResult)
async def validate_task(filename: str):
    """Validate a task file."""
    settings = state_module.app_state.settings
    try:
        return task_service.validate_task_file(filename, settings=settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Task not found: {filename}")
