# Future Improvements

Items are scored by **Impact** (value to users, 1-10) and **Difficulty** (implementation effort, 1-10).

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

## Screenshot Baselines & Visual Regression — Impact: 9 | Difficulty: 8
Multi-part feature for comparing screenshots against known-good baselines:
- **Baseline Storage & Management** — "Set as Baseline" button on passing reports, copies screenshots to a stable per-test location. "Update Baseline" to replace with a new passing run.
- **Screenshot Comparison Viewer** — Side-by-side, toggle, and overlay display modes when viewing a failed report against its baseline. Highlight changed regions in overlay mode.
- **compare_screenshot Step Type** — New step that compares the current screen against the baseline with a configurable similarity threshold.

## Remote Access & Multi-User Support — Impact: 8 | Difficulty: 8
Allow the wintest web server to be accessed from other machines on the network so team members can view reports, trigger runs, and monitor progress without needing GPU hardware locally. Requires:
- **Authentication** — login system or API keys (critical since tests control mouse/keyboard on the host)
- **Role-based access** — viewer (read-only) and operator (can trigger/cancel runs) roles
- **HTTPS** — encrypt traffic, especially credentials
- **Concurrency UX** — clear feedback when a run is already in progress
- Ties into Environment Isolation

## Vision Model Tiling (Dynamic Resolution) — Impact: 10 | Difficulty: 6
The vision model currently resizes the entire screenshot (e.g. 2560x1440) down to 448x448, losing critical detail for small UI elements like menu text. InternVL2 supports dynamic resolution / tile mode where the image is split into 448x448 tiles that are processed together, preserving detail. Implementing this would dramatically improve click accuracy for small elements and dense UIs. This is the single biggest improvement that can be made to test reliability.

## Retry Failed Tests in Suites — Impact: 6 | Difficulty: 3
Re-run only the failed tests from a completed suite run, instead of re-running the entire suite.

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
