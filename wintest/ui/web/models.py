"""Pydantic models for the web API."""

from pydantic import BaseModel


class StepModel(BaseModel):
    action: str
    description: str = ""
    target: str | None = None
    text: str | None = None
    key: str | None = None
    keys: list[str] | None = None
    scroll_amount: int = 0
    wait_seconds: float = 0.0
    expected: bool = True
    retry_attempts: int = 3
    retry_delay: float = 2.0
    timeout: float | None = None
    app_path: str | None = None
    app_title: str | None = None
    variable_name: str | None = None
    variable_value: str | None = None


class TestModel(BaseModel):
    name: str
    filename: str | None = None
    steps: list[StepModel]
    settings: dict = {}
    variables: dict = {}


class TestListItem(BaseModel):
    filename: str
    name: str
    step_count: int


class RunRequest(BaseModel):
    test_file: str


class RunResponse(BaseModel):
    run_id: str
    status: str
    test_name: str
    total_steps: int


class StepResultModel(BaseModel):
    step_num: int
    description: str
    action: str
    passed: bool
    duration_seconds: float
    error: str | None = None
    coordinates: list[int] | None = None
    screenshot_url: str | None = None


class RunStatus(BaseModel):
    run_id: str | None = None
    status: str  # idle, running, completed, failed
    test_name: str | None = None
    current_step: int | None = None
    total_steps: int | None = None
    step_results: list[StepResultModel] = []


class ModelStatus(BaseModel):
    status: str  # not_loaded, loading, loaded


class ReportSummary(BaseModel):
    report_id: str
    test_name: str
    passed: bool
    total: int
    passed_count: int
    failed_count: int
    generated_at: str


class ValidationResult(BaseModel):
    valid: bool
    issues: list[str]


class FieldInfo(BaseModel):
    name: str
    field_type: str
    required: bool = False


class StepInfo(BaseModel):
    name: str
    description: str
    required_fields: list[str]
    fields: list[FieldInfo] = []


class TestSuiteModel(BaseModel):
    name: str
    filename: str | None = None
    description: str = ""
    test_paths: list[str]
    settings: dict = {}


class TestSuiteListItem(BaseModel):
    filename: str
    name: str
    description: str = ""
    test_count: int


class RunTestSuiteRequest(BaseModel):
    suite_file: str


class RunTestSuiteResponse(BaseModel):
    run_id: str
    status: str
    suite_name: str
    total_tests: int
