export interface Step {
  action: string;
  description: string;
  target: string | null;
  text: string | null;
  key: string | null;
  keys: string[] | null;
  scroll_amount: number;
  wait_seconds: number;
  expected: boolean;
  retry_attempts: number;
  retry_delay: number;
  timeout: number | null;
  app_path: string | null;
  app_title: string | null;
  variable_name: string | null;
  variable_value: string | null;
  loop_target: number | null;
  repeat: number;
  click_x: number | null;
  click_y: number | null;
}

export interface Test {
  name: string;
  filename: string | null;
  steps: Step[];
  settings: Record<string, unknown>;
  variables: Record<string, string>;
  tags: string[];
}

export interface TestListItem {
  filename: string;
  name: string;
  step_count: number;
  tags: string[];
}

export interface FieldInfo {
  name: string;
  field_type: string;
  required: boolean;
}

export interface StepInfo {
  name: string;
  description: string;
  required_fields: string[];
  fields: FieldInfo[];
  is_runner_step: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export interface ReportSummary {
  report_id: string;
  test_name: string;
  passed: boolean;
  total: number;
  passed_count: number;
  failed_count: number;
  generated_at: string;
  duration_seconds: number;
}

export interface ReportData {
  test_name: string;
  passed: boolean;
  summary: { total: number; passed: number; failed: number };
  generated_at: string;
  steps: ReportStep[];
}

export interface ReportStep {
  description: string;
  action: string;
  target: string | null;
  passed: boolean;
  duration_seconds: number;
  error: string | null;
  coordinates: number[] | null;
  model_response: string | null;
  screenshot_path: string | null;
}

export interface RunResponse {
  run_id: string;
  status: string;
  test_name: string;
  total_steps: number;
}

export interface RunStatus {
  run_id: string | null;
  status: string;
  test_name: string | null;
  current_step: number | null;
  total_steps: number | null;
  step_results: StepResultData[];
  source_file: string | null;
  run_type: string | null;
}

export interface StepResultData {
  step_num: number;
  description: string;
  action: string;
  passed: boolean;
  duration_seconds: number;
  error: string | null;
  coordinates: number[] | null;
  screenshot_base64?: string | null;
  screenshot_url?: string | null;
}

export interface WsMessage {
  type: string;
  run_id?: string;
  test_name?: string;
  total_steps?: number;
  step_num?: number;
  label?: string;
  passed?: boolean;
  duration_seconds?: number;
  error?: string;
  coordinates?: number[] | null;
  action?: string;
  screenshot_base64?: string | null;
  summary?: { total: number; passed: number; failed: number };
  message?: string;
  status?: string;
  current_step?: number;
  step_results?: StepResultData[];
  source_file?: string;
  run_type?: string;
  level?: string;
  timestamp?: string;
}

export interface TestSuite {
  name: string;
  filename: string | null;
  description: string;
  test_paths: string[];
  settings: Record<string, unknown>;
}

export interface TestSuiteListItem {
  filename: string;
  name: string;
  description: string;
  test_count: number;
}

export interface RunTestSuiteResponse {
  run_id: string;
  status: string;
  suite_name: string;
  total_tests: number;
}

export function newStep(): Step {
  return {
    action: 'click',
    description: '',
    target: null,
    text: null,
    key: null,
    keys: null,
    scroll_amount: 0,
    wait_seconds: 0,
    expected: true,
    retry_attempts: 3,
    retry_delay: 2.0,
    timeout: null,
    app_path: null,
    app_title: null,
    variable_name: null,
    variable_value: null,
    loop_target: null,
    repeat: 0,
    click_x: null,
    click_y: null,
  };
}
