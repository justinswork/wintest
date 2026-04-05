# Future Improvements

## Remote Access & Multi-User Support
Allow the wintest web server to be accessed from other machines on the network so team members can view reports, trigger runs, and monitor progress without needing GPU hardware locally. The server already supports `--host 0.0.0.0` to bind to all interfaces, but exposing it requires:
- **Authentication** — login system or API keys to prevent unauthorized access (critical since tests control mouse/keyboard on the host)
- **Role-based access** — separate viewer (read-only: reports, status) and operator (can trigger/cancel runs) roles
- **HTTPS** — encrypt traffic, especially credentials
- **Concurrency UX** — clear feedback when a run is already in progress and another user tries to start one
- Ties into the Environment Isolation item — remote-triggered runs shouldn't interfere with the host user's desktop

## Suite Reports & PDF Export
Generate a combined report for test suite runs that includes a summary page (suite name, total tests, pass/fail counts) followed by the full report for each individual test. Export the combined suite report as a single PDF. Currently each test in a suite generates its own independent report with no suite-level aggregation.

## Suite Execution Viewer
The execution viewer currently shows no progress during suite runs — it only handles single-test step messages. Add handling for `test_suite_test_started` and `test_suite_test_completed` WebSocket messages to show per-test progress during a suite run (e.g. "Test 2/3: Notepad Basic Test — PASSED").

## Report Template Customization
Allow users to customize the PDF report template with their own branding — logo, company name, colors, header/footer text. Could be a config file or a custom Jinja2 template that overrides the default.

## User-Defined Custom Steps
Allow users to define their own custom step types (composite steps or macros) that combine multiple built-in steps into a reusable action. This would reduce repetition across tests.

## Screenshot Baselines & Visual Regression
Multi-part feature for comparing screenshots against known-good baselines:

### Baseline Storage & Management
- Add a "Set as Baseline" button on passing reports that copies screenshots to a stable per-test location (e.g. `baselines/<test_name>/step_1.png`)
- Baselines persist independently of report cleanup
- "Update Baseline" to replace an existing baseline with a new passing run

### Screenshot Comparison Viewer
- When viewing a failed report, show the baseline screenshot alongside the actual screenshot for each step
- Three display modes the user can toggle between: side-by-side, toggle (flip between images), and overlay (diff highlight)
- Highlight changed regions in the overlay mode

### compare_screenshot Step Type
- New step type that compares the current screen against the baseline screenshot for that step
- Configurable similarity threshold (exact pixel match is too strict due to font rendering, DPI, etc.)
- Passes if the screenshots are similar enough, fails with a visual diff if not

## Scheduled Test Runs
Run tests or suites on a cron schedule (e.g. nightly smoke tests) without manual intervention.

## Retry Failed Tests in Suites
Re-run only the failed tests from a completed suite run, instead of re-running the entire suite.

## Test Recorder
Record clicks and keystrokes on the desktop and auto-generate a test YAML from the recording. Should capture mouse clicks (with screen region descriptions), keyboard input, and timing between actions. Ideally runs as an overlay or background listener that the user can start/stop from the web UI.

## Import / Export Test Bundles
Tests are already plain YAML files that can be copied between machines. This item is about bundling — export a test suite and all its referenced test files as a single zip/archive, and import that bundle on another machine to recreate the suite and tests in one step.

## Keyboard Shortcuts
Global hotkeys to start/stop runs without switching to the browser.

## Trend Dashboard
Track pass/fail rates over time with charts showing test health trends.

## Notification Hooks
Send results to Slack, email, or a webhook on test completion or failure.

## Test Duration Tracking & Named Timers
Show how long each test and step takes over time to catch performance regressions. Additionally, allow users to define named timers that can be started and stopped within a test (e.g. `start_timer: "load_time"`, `stop_timer: "load_time"`), and add assertion steps to check elapsed time against thresholds (e.g. `assert_timer: { name: "load_time", max_seconds: 5 }`). This enables explicit performance regression testing within test definitions.

## File Comparison Assertion
Add a step type (e.g. `compare_file`) that compares a file produced during a test against a known-good reference file. Useful for testing export workflows — run the app, trigger an export (Save As, etc.), then assert the output matches the expected file. Should support exact match, and optionally ignore whitespace or specific lines.

## Step Snippets
Allow saving a group of steps as a reusable snippet file. Users could select a range of steps in the editor, save them as a named snippet (stored as a small YAML file), and later insert that snippet into any test. Useful for common setup/teardown sequences like "open File menu and click Save As" or "log into the application".

## Test Cleanup & Artifact Management
Ensure tests clean up after themselves. Add a `cleanup` section to test YAML that runs after the test completes (pass or fail) — e.g. delete temp files, close extra windows, restore settings. Add a `delete_files` option that automatically removes any files created during the test run (tracked via filesystem monitoring or explicit paths). Consider a `workspace` directory per test run where all artifacts are collected and can be easily wiped.

## Fluent Assertions
Add richer validation steps that read like fluent assertions. Support natural language-style conditions such as `"x" should be "5"`, `"x" should be equal to "y"`, `"x" should contain "hello"`, `"x" should be greater than 10`. These would work with test variables and model-extracted values to enable data-driven verification beyond just visual element presence.

## Environment Isolation
Investigate ways to isolate the test execution environment from the user's desktop to prevent interference. Options to explore:
- **Virtual desktop:** Create a dedicated Windows virtual desktop (`CreateDesktop` API) for the test run, keeping the user's desktop untouched.
- **Monitor blackout:** Optionally black out secondary monitors during a run so the AI model only sees the target app on one screen.
- **Input isolation:** Prevent user mouse/keyboard input from interfering with a running test (or at least warn/pause if user input is detected).
- **Window-only capture:** Capture only the target application window instead of the full screen, reducing noise from other windows and making the test more reliable.

## Variables UI Improvements
Add a side panel in the test editor for variable definitions, and provide a dropdown in the `set_variable` step to select from existing variables. Consider showing which steps reference each variable.

## Runtime Variable Capture
Extend the variable system to capture values from step results at runtime — e.g., a `read_text` step that asks the vision model to extract text from the screen and store it in a variable.
