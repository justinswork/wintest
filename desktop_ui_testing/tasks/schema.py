from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ActionType(Enum):
    CLICK = "click"
    DOUBLE_CLICK = "double_click"
    RIGHT_CLICK = "right_click"
    TYPE = "type"
    PRESS_KEY = "press_key"
    HOTKEY = "hotkey"
    SCROLL = "scroll"
    WAIT = "wait"
    VERIFY = "verify"


@dataclass
class Step:
    action: ActionType
    description: str = ""
    target: Optional[str] = None
    text: Optional[str] = None
    key: Optional[str] = None
    keys: Optional[list[str]] = None
    scroll_amount: int = 0
    wait_seconds: float = 0.0
    expected: bool = True
    retry_attempts: int = 3
    retry_delay: float = 2.0


@dataclass
class TaskDefinition:
    name: str
    steps: list[Step]
    application: Optional[dict] = None
    settings: dict = field(default_factory=dict)


@dataclass
class StepResult:
    step: Step
    passed: bool
    error: Optional[str] = None
    coordinates: Optional[tuple[int, int]] = None
    model_response: Optional[str] = None
    screenshot_path: Optional[str] = None
    duration_seconds: float = 0.0


@dataclass
class TaskResult:
    task_name: str
    step_results: list[StepResult]

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.step_results)

    @property
    def summary(self) -> dict:
        total = len(self.step_results)
        passed = sum(1 for r in self.step_results if r.passed)
        return {"total": total, "passed": passed, "failed": total - passed}
