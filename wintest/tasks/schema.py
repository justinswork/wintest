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
    variable_name: Optional[str] = None
    variable_value: Optional[str] = None
    loop_target: Optional[int] = None
    repeat: int = 0
    click_x: Optional[float] = None
    click_y: Optional[float] = None
    click_type: str = "click"  # "click", "double_click", "right_click", "middle_click"
    region: Optional[list[float]] = None  # [x1, y1, x2, y2] normalized 0-1
    baseline_id: Optional[str] = None     # ID referencing saved baseline image/file
    similarity_threshold: float = 0.90    # 0-1, how similar the region must be
    file_path: Optional[str] = None       # path to file to compare
    compare_mode: str = "exact"           # "exact" or "image"


@dataclass
class TestDefinition:
    name: str
    steps: list[Step]
    settings: dict = field(default_factory=dict)
    variables: dict = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)


@dataclass
class StepResult:
    step: Step
    passed: bool
    error: Optional[str] = None
    coordinates: Optional[tuple[int, int]] = None
    model_response: Optional[str] = None
    screenshot_path: Optional[str] = None
    duration_seconds: float = 0.0
    actual_screenshot_path: Optional[str] = None
    baseline_screenshot_path: Optional[str] = None


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
