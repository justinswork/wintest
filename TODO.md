# Future Improvements

## Export Reports to PDF
Add the ability to export test reports as PDF files. This would make it easy to share results with stakeholders or archive them outside the application.

## User-Defined Custom Steps
Allow users to define their own custom step types (composite steps or macros) that combine multiple built-in steps into a reusable action. This would reduce repetition across tests.

## Screenshot Comparison / Visual Regression
Compare screenshots against saved baseline images to automatically detect unexpected UI changes between runs.

## Scheduled Test Runs
Run tests or suites on a cron schedule (e.g. nightly smoke tests) without manual intervention.

## Retry Failed Tests in Suites
Re-run only the failed tests from a completed suite run, instead of re-running the entire suite.

## Test Tagging & Filtering
Tag tests (e.g. "smoke", "regression", "critical") and run filtered subsets from the UI.

## Test Recorder
Record clicks and keystrokes on the desktop and auto-generate a test YAML from the recording. Should capture mouse clicks (with screen region descriptions), keyboard input, and timing between actions. Ideally runs as an overlay or background listener that the user can start/stop from the web UI.

## Step Screenshot Preview
Show the screenshot from the last run inline in the test editor, so you can see what each step looked like.

## Import / Export Tests
Export tests as shareable YAML bundles (with suites) and import them, for sharing across teams or machines.

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
