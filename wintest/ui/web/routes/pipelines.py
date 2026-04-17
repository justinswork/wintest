"""Pipeline CRUD + scheduler status API routes."""

from fastapi import APIRouter, HTTPException

from ..models import PipelineModel, PipelineListItem, SchedulerStatus, PipelineEnabledRequest
from ..services import pipeline_service

router = APIRouter()


@router.get("", response_model=list[PipelineListItem])
async def list_pipelines():
    return pipeline_service.list_pipelines()


@router.get("/scheduler-status", response_model=SchedulerStatus)
async def scheduler_status():
    return pipeline_service.get_scheduler_status()


@router.post("/scheduler/start", response_model=dict)
async def start_scheduler():
    return pipeline_service.start_scheduler()


@router.post("/scheduler/stop", response_model=dict)
async def stop_scheduler():
    return pipeline_service.stop_scheduler()


@router.get("/file/{filepath:path}", response_model=PipelineModel)
async def get_pipeline(filepath: str):
    try:
        return pipeline_service.get_pipeline(filepath)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Pipeline not found: {filepath}")


@router.post("", response_model=dict)
async def create_pipeline(pipeline: PipelineModel):
    filename = pipeline_service.save_pipeline(pipeline)
    return {"filename": filename}


@router.put("/file/{filepath:path}", response_model=dict)
async def update_pipeline(filepath: str, pipeline: PipelineModel):
    try:
        pipeline_service.get_pipeline(filepath)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Pipeline not found: {filepath}")
    pipeline_service.save_pipeline(pipeline, filename=filepath)
    return {"filename": filepath}


@router.delete("/file/{filepath:path}")
async def delete_pipeline(filepath: str):
    try:
        pipeline_service.delete_pipeline(filepath)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Pipeline not found: {filepath}")
    return {"deleted": filepath}


@router.patch("/file/{filepath:path}/enabled", response_model=dict)
async def set_enabled(filepath: str, body: PipelineEnabledRequest):
    try:
        pipeline_service.set_enabled(filepath, body.enabled)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Pipeline not found: {filepath}")
    return {"filename": filepath, "enabled": body.enabled}
