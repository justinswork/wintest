"""Base types for step definitions."""

from dataclasses import dataclass, field
from typing import Callable


@dataclass
class FieldDef:
    """Declares a field that a step type uses."""

    name: str  # "target", "text", etc.
    field_type: str  # "string", "number", "string[]"
    required: bool = False


@dataclass
class StepDefinition:
    """Self-contained definition for a step type."""

    name: str  # "click"
    description: str  # "Click on a UI element..."
    fields: list[FieldDef]  # Which Step fields this action uses
    validate: Callable  # (step, step_num) -> list[str]
    execute: Callable  # (step, context) -> StepResult
    is_runner_step: bool = False  # True = runner handles, not agent
