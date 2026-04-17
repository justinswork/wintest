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
    loop_target: int | None = None
    repeat: int = 0
    click_x: float | None = None
    click_y: float | None = None
    click_type: str = "click"
    region: list[float] | None = None
    baseline_id: str | None = None
    similarity_threshold: float = 0.90
    file_path: str | None = None
    compare_mode: str = "exact"


class TestModel(BaseModel):
    name: str
    filename: str | None = None
    steps: list[StepModel]
    settings: dict = {}
    variables: dict = {}
    tags: list[str] = []


class TestListItem(BaseModel):
    filename: str
    name: str
    step_count: int
    tags: list[str] = []


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
    source_file: str | None = None
    run_type: str | None = None


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
    duration_seconds: float = 0.0


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
    is_runner_step: bool = False


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


class PipelineModel(BaseModel):
    name: str
    filename: str | None = None
    enabled: bool = True
    target_type: str = "test"  # "test" or "suite"
    target_file: str
    schedule_days: list[str] = []
    schedule_time: str = "00:00"


class PipelineListItem(BaseModel):
    filename: str
    name: str
    enabled: bool
    target_type: str
    target_file: str
    schedule_days: list[str]
    schedule_time: str
    last_run_at: str | None = None
    last_run_passed: bool | None = None


class SchedulerCurrentRun(BaseModel):
    pipeline_filename: str
    pipeline_name: str
    target_type: str
    target_file: str
    started_at: str


class SchedulerStatus(BaseModel):
    running: bool
    pid: int | None = None
    started_at: str | None = None
    current_run: SchedulerCurrentRun | None = None


class PipelineEnabledRequest(BaseModel):
    enabled: bool
