from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Step:
    action: str
    description: str = ""
    target: Optional[str] = None
    text: Optional[str] = None
    key: Optional[str] = None
    keys: Optional[list[str]] = None
    scroll_amount: int = 0
    wait_seconds: float = 0.0
    app_path: Optional[str] = None
    app_title: Optional[str] = None
    expected: bool = True
    retry_attempts: int = 3
    retry_delay: float = 2.0
    timeout: Optional[float] = None


@dataclass
class TestDefinition:
    name: str
    steps: list[Step]
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
class TestResult:
    test_name: str
    step_results: list[StepResult]

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.step_results)

    @property
    def summary(self) -> dict:
        total = len(self.step_results)
        passed = sum(1 for r in self.step_results if r.passed)
        return {"total": total, "passed": passed, "failed": total - passed}


@dataclass
class TestSuiteDefinition:
    name: str
    test_paths: list[str]
    description: str = ""
    settings: dict = field(default_factory=dict)


@dataclass
class TestSuiteResult:
    suite_name: str
    test_results: list[TestResult]

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.test_results)

    @property
    def summary(self) -> dict:
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r.passed)
        return {"total_tests": total, "passed": passed, "failed": total - passed}
