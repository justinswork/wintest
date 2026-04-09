"""Settings API routes."""

from fastapi import APIRouter
from pydantic import BaseModel

from .. import state as state_module

router = APIRouter()

AVAILABLE_MODELS = [
    {
        "id": "showlab/ShowUI-2B",
        "name": "ShowUI-2B",
        "description": "GUI-specialized click grounding model (recommended)",
        "size": "~4 GB",
    },
    {
        "id": "Qwen/Qwen2.5-VL-7B-Instruct",
        "name": "Qwen2.5-VL-7B",
        "description": "Larger general-purpose vision model with grounding support",
        "size": "~8 GB (4-bit)",
    },
    {
        "id": "Qwen/Qwen2.5-VL-3B-Instruct",
        "name": "Qwen2.5-VL-3B",
        "description": "Mid-size general-purpose vision model with grounding support",
        "size": "~4 GB (4-bit)",
    },
]


class ModelSettingRequest(BaseModel):
    model_path: str


@router.get("/model")
async def get_model_setting():
    """Get the current model configuration."""
    app_state = state_module.app_state
    return {
        "model_path": app_state.settings.model.model_path,
        "model_status": app_state.model_status,
        "available_models": AVAILABLE_MODELS,
    }


@router.put("/model")
async def set_model_setting(request: ModelSettingRequest):
    """Change the vision model. Requires restart/reload to take effect."""
    app_state = state_module.app_state
    old_path = app_state.settings.model.model_path
    app_state.settings.model.model_path = request.model_path

    # If model is already loaded and we're switching, mark for reload
    if old_path != request.model_path and app_state.vision_model is not None:
        app_state.vision_model = None
        app_state.model_status = "not_loaded"

    return {
        "model_path": request.model_path,
        "model_status": app_state.model_status,
        "needs_reload": old_path != request.model_path,
    }
