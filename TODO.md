# Future Improvements

Items are scored by **Impact** (value to users, 1-10) and **Difficulty** (implementation effort, 1-10).

---

## Result Notes & Annotations — Impact: 6 | Difficulty: 4
Allow users to add notes to test results, both at the test level and per step. Useful for documenting why a test failed, what was investigated, or any observations. Notes would be stored in the report JSON and included in the PDF export. Could include:
- A text field on the result viewer page for test-level notes
- Per-step notes that expand inline when viewing step details
- Timestamps on notes for tracking investigation progress
- Notes persist with the report and appear in exported PDFs

## Suite Execution Viewer — Impact: 8 | Difficulty: 3
The execution viewer currently shows no progress during suite runs — it only handles single-test step messages. Add handling for `test_suite_test_started` and `test_suite_test_completed` WebSocket messages to show per-test progress during a suite run (e.g. "Test 2/3: Notepad Basic Test — PASSED").

## Runtime Variable Capture — Impact: 8 | Difficulty: 4
Extend the variable system to capture values from step results at runtime — e.g., a `read_text` step that asks the vision model to extract text from the screen and store it in a variable.

## Suite Reports & PDF Export — Impact: 7 | Difficulty: 5
Generate a combined report for test suite runs that includes a summary page (suite name, total tests, pass/fail counts) followed by the full report for each individual test. Export the combined suite report as a single PDF. Currently each test in a suite generates its own independent report with no suite-level aggregation.

## Failure Handling & Cleanup Sections — Impact: 8 | Difficulty: 5
Add two optional step sections to test YAML that run after the main steps:
- **`on_failure`** — steps that only run when a step fails. Useful for error recovery, dismissing dialogs, capturing diagnostic info, or taking extra screenshots.
- **`cleanup`** — steps that always run regardless of pass/fail. Useful for closing applications, deleting temp files, restoring settings, and ensuring a clean state for the next test.

```yaml
steps:
  - action: click
    target: "Save button"

on_failure:
  - action: click
    target: "Cancel button"

cleanup:
  - action: press_key
    key: "alt+f4"
```

Avoids programming terminology (try/catch/finally) while giving users the same control. The runner would execute: steps -> on_failure (if any step failed) -> cleanup (always). Could also add a `delete_files` option and per-test `workspace` directory for artifact management.

## Notification Hooks — Impact: 7 | Difficulty: 4
Send results to Slack, email, or a webhook on test completion or failure. Webhook is the simplest starting point; Slack/email integration adds scope.

## Scheduled Test Runs — Impact: 7 | Difficulty: 5
Run tests or suites on a cron schedule (e.g. nightly smoke tests) without manual intervention. Needs a scheduler and persistence across restarts.

## Environment Isolation — Impact: 7 | Difficulty: 9
Investigate ways to isolate the test execution environment from the user's desktop to prevent interference. Options to explore:
- **Virtual desktop:** Create a dedicated Windows virtual desktop (`CreateDesktop` API) for the test run, keeping the user's desktop untouched.
- **Monitor blackout:** Optionally black out secondary monitors during a run so the AI model only sees the target app on one screen.
- **Input isolation:** Prevent user mouse/keyboard input from interfering with a running test (or at least warn/pause if user input is detected).
- **Window-only capture:** Capture only the target application window instead of the full screen, reducing noise from other windows and making the test more reliable.

## Screenshot Comparison Viewer — Impact: 6 | Difficulty: 5
The verify_screenshot step and baseline storage are implemented. Remaining work:
- **Side-by-side viewer** in the report viewer — show baseline vs actual vs diff images when viewing a failed verify_screenshot step
- **Toggle and overlay display modes** — let users flip between the three comparison views
- **"Set as Baseline" from reports** — button on passing runs to update the baseline from the actual screenshot
- **"Update Baseline" in builder** — re-capture and replace an existing baseline

## Remote Access & Multi-User Support — Impact: 8 | Difficulty: 8
Allow the wintest web server to be accessed from other machines on the network so team members can view reports, trigger runs, and monitor progress without needing GPU hardware locally. Requires:
- **Authentication** — login system or API keys (critical since tests control mouse/keyboard on the host)
- **Role-based access** — viewer (read-only) and operator (can trigger/cancel runs) roles
- **HTTPS** — encrypt traffic, especially credentials
- **Concurrency UX** — clear feedback when a run is already in progress
- Ties into Environment Isolation

## Accessibility-Based Element Identification — Impact: 10 | Difficulty: 8
The single biggest capability gap vs. TestComplete and Ranorex (see [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md)). Both tools identify UI elements by reading the accessibility tree — Microsoft UI Automation (UIA), MSAA, and framework-specific APIs — rather than by pixel coordinates. Tests stay resilient when windows resize, controls shift, DPI changes, or layouts get re-themed.

The work:
- **Integrate UI Automation** via `comtypes` or `pywinauto` to walk the element tree and read properties (`Name`, `AutomationId`, `ClassName`, `ControlType`).
- **New step mode** — a click step can target by accessibility properties (e.g. `target_automation_id: "SaveButton"`) instead of, or in addition to, `click_x`/`click_y`.
- **Builder recording** — when the user clicks on the screenshot, look up the element under the cursor in the accessibility tree and record its properties. Fall back to coordinates when the element isn't exposed via accessibility (games, custom-drawn UIs, etc.).
- **Element inspector** in the Builder — hover an element to see its properties, like TestComplete's "object spy".
- **Backwards compat** — existing coordinate-based tests keep working. This is additive.

Would put wintest on near-equal footing with the commercial tools for any app with accessibility support, which is the majority of modern Windows apps (WPF, WinForms, UWP, Qt, Electron, most .NET apps).

## Self-Healing Tests — Impact: 7 | Difficulty: 7
Depends on **Accessibility-Based Element Identification** being in place first. When a step fails to locate its target, automatically try alternative identification strategies — e.g., if `AutomationId` doesn't match anymore, try finding an element with the same `Name` and `ControlType` nearby, or fall back to the AI vision model, or use the original recorded coordinates as a last resort.

On recovery, log what strategy was used and offer a "Accept and update" button in the report so the user can permanently update the test to the new identifier.

Only reasonable once there are multiple identification strategies to fall back between — otherwise there's nothing to heal *to*.

## Data-Driven Testing — Impact: 7 | Difficulty: 5
Run the same test N times with different input data.

```yaml
name: Create invoice for multiple customers
data_source:
  file: customers.csv
steps:
  - action: type
    text: "{{row.customer_name}}"
  - action: type
    text: "{{row.amount}}"
```

The runner iterates over rows in the CSV/Excel file, binds each row into a `{{row.*}}` namespace, and runs the whole test once per row. Each iteration produces its own report entry so failures can be tracked per row. Supports CSV minimally; Excel via `openpyxl` as a follow-up.

## Vision Model Accuracy — Impact: 10 | Difficulty: 8
AI-based element grounding (clicking by description) works but is not reliable enough for production use. Current approach uses coordinate-based clicking as the primary method. Future improvements:
- **Fine-tune a custom model** on UI screenshot datasets for accurate element grounding
- **Evaluate newer models** as they become available (GUI-Actor, UI-TARS, etc.)
- **Hybrid approach** — use AI for verification/element presence checks while coordinate clicking handles actions

## Retry Failed Tests in Suites — Impact: 6 | Difficulty: 3
Re-run only the failed tests from a completed suite run, instead of re-running the entire suite.

## Test-Level Timeout — Impact: 7 | Difficulty: 3
Kill a test run if it exceeds a maximum duration. Step-level timeouts already exist, but a hung step that keeps retrying, or a loop that never terminates, can block the scheduler indefinitely.

Each test can specify its own `timeout_seconds` in the YAML (and as a field in the Test Editor), since a quick smoke test shouldn't share the same ceiling as a long export-and-compare regression test. If a test doesn't set one, use a workspace-wide default — 5 minutes seems like a safe starting point for typical UI tests without interrupting legitimately long-running ones. Suites could optionally define their own default that cascades to tests that don't set one.

When the timeout hits, mark the test as failed with a "Test exceeded timeout of Xm" error and proceed to the next test in the suite.

## Failure Reason Codes — Impact: 8 | Difficulty: 5
Every failed test should report a structured failure *reason* alongside the free-text error message, so users can quickly see why a test failed without opening the full report — and so failures can be grouped and analyzed on the Trends page.

Formalize a category of "validation" steps (currently: `verify`, `verify_screenshot`, `compare_saved_file`; eventually fluent assertions, runtime variable checks, etc.) as distinct from action steps. Validation steps are the ones that *intentionally* produce a pass/fail signal; action steps only fail when something unexpected breaks. Each failure type maps to a reason code.

Proposed codes:
- `timeout` — test exceeded its timeout
- `file_mismatch` — `compare_saved_file` found a diff
- `screenshot_mismatch` — `verify_screenshot` region didn't match baseline
- `element_not_found` — AI-based click/verify couldn't locate the target
- `assertion_failed` — generic fluent-assertion failure
- `app_launch_failed` — `launch_application` couldn't start the app
- `step_error` — unexpected runtime error (catch-all for bugs / infra issues)
- `cancelled` — user cancelled the run

Surface the code in:
- The report JSON as a top-level `failure_reason` field (set to the failing step's reason)
- The report viewer as a colored badge next to the pass/fail status
- The Results list as a small badge on each failed run
- The Trends detail view, so users can spot patterns like "3 timeouts this week, all on CRM tests"

Each step type declares its own set of possible reason codes so the runner can attach the right one automatically.

## User-Defined Custom Steps — Impact: 6 | Difficulty: 6
Allow users to define their own custom step types (composite steps or macros) that combine multiple built-in steps into a reusable action. This would reduce repetition across tests. Needs a macro definition format and execution model.

## Fluent Assertions — Impact: 6 | Difficulty: 5
Add richer validation steps that read like fluent assertions. Support natural language-style conditions such as `"x" should be "5"`, `"x" should be equal to "y"`, `"x" should contain "hello"`, `"x" should be greater than 10`. These would work with test variables and model-extracted values to enable data-driven verification beyond just visual element presence.

## Step Snippets — Impact: 5 | Difficulty: 3
Allow saving a group of steps as a reusable snippet file. Users could select a range of steps in the editor, save them as a named snippet (stored as a small YAML file), and later insert that snippet into any test. Useful for common setup/teardown sequences like "open File menu and click Save As" or "log into the application".

## File Comparison Assertion — Impact: 5 | Difficulty: 3
Add a step type (e.g. `compare_file`) that compares a file produced during a test against a known-good reference file. Useful for testing export workflows — run the app, trigger an export (Save As, etc.), then assert the output matches the expected file. Should support exact match, and optionally ignore whitespace or specific lines.

## Test Duration Tracking & Named Timers — Impact: 5 | Difficulty: 4
Basic duration tracking is now available in the Trends dashboard. This item adds named timers that can be started and stopped within a test (e.g. `start_timer: "load_time"`, `stop_timer: "load_time"`), and assertion steps to check elapsed time against thresholds (e.g. `assert_timer: { name: "load_time", max_seconds: 5 }`).

## Report Template Customization — Impact: 4 | Difficulty: 4
Allow users to customize the PDF report template with their own branding — logo, company name, colors, header/footer text. Could be a config file or a custom Jinja2 template that overrides the default.

## Variables UI Improvements — Impact: 3 | Difficulty: 4
Add a side panel in the test editor for variable definitions, and provide a dropdown in the `set_variable` step to select from existing variables. Consider showing which steps reference each variable.

## Import / Export Test Bundles — Impact: 3 | Difficulty: 3
Tests are already plain YAML files that can be copied between machines. This item is about bundling — export a test suite and all its referenced test files as a single zip/archive, and import that bundle on another machine to recreate the suite and tests in one step.

## Keyboard Shortcuts — Impact: 3 | Difficulty: 3
Global hotkeys to start/stop runs without switching to the browser.

## CI/CD Integration — Impact: 6 | Difficulty: 4
Make wintest easy to plug into existing CI/CD pipelines (GitHub Actions, Azure DevOps Pipelines, Jenkins, TeamCity). The CLI already exits 0/1 based on pass/fail, but needs:
- **JUnit XML output** — standard format that virtually every CI system can consume to surface test results in their native UI. Add a `--junit-out <path>` flag to `wintest run` and `wintest run-test-suite`.
- **Sample pipeline configs** — ship ready-to-use `.github/workflows/`, `azure-pipelines.yml`, and `Jenkinsfile` examples showing how to run wintest on a self-hosted Windows runner.
- **Non-interactive mode** — skip any UI prompts; fail loudly with a clear message when a workspace isn't configured in headless environments.
- **Test result annotations** — for GitHub Actions, emit `::error::` / `::warning::` workflow commands so failures show up as inline PR comments.

The self-hosted-runner + interactive-session constraint is the same as the scheduler (documented in README), so deployment looks the same.

## Test Management Integrations — Impact: 5 | Difficulty: 6
Link wintest tests to test cases in external test management systems (Jira/Xray, Azure DevOps Test Plans, TestRail). When a test runs, it pushes results back to the linked test case so QA teams can track coverage without maintaining two separate sources of truth. Start with one integration (Azure DevOps is probably the easiest given its API) and generalize.

---

# Research & Competitive Analysis

## Done: TestComplete and Ranorex research
See [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md). Biggest gaps identified and promoted to TODO items above: accessibility-based element identification, self-healing tests, data-driven testing, CI/CD integration, test management integrations.
