"""Vision model factory — select the right model based on settings."""

import logging

from .base import BaseVisionModel

logger = logging.getLogger(__name__)

# Map known model paths/names to their implementation
_MODEL_REGISTRY = {
    "showlab/ShowUI-2B": "showui",
    "Qwen/Qwen2.5-VL-7B-Instruct": "qwen25vl",
    "Qwen/Qwen2.5-VL-3B-Instruct": "qwen25vl",
    "Qwen/Qwen2.5-VL-2B-Instruct": "qwen25vl",
}


def get_model(model_settings) -> BaseVisionModel:
    """Create a vision model instance based on model_settings.model_path."""
    model_path = model_settings.model_path

    # Check registry for known models
    impl = _MODEL_REGISTRY.get(model_path)

    if impl == "showui":
        from .showui import ShowUIModel
        return ShowUIModel(model_settings)

    if impl == "qwen25vl":
        from .qwen25vl import Qwen25VLModel
        return Qwen25VLModel(model_settings)

    # Default to ShowUI for unknown models
    from .showui import ShowUIModel
    return ShowUIModel(model_settings)


# Backwards compatibility: VisionModel alias
class VisionModel:
    """Factory wrapper for backwards compatibility.

    Code that does `VisionModel(settings)` will get the right model
    based on settings.model_path.
    """

    def __new__(cls, model_settings=None):
        if model_settings is None:
            from ...config.settings import ModelSettings
            model_settings = ModelSettings()
        return get_model(model_settings)
