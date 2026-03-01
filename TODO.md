# Future Improvements

## 1. Live Console Log Viewer
Show the real-time console/log output for a running test or test suite in the web UI. This would allow users to see detailed runner logs, model responses, and debug info without needing access to the server terminal.

## 2. Export Reports to PDF
Add the ability to export test reports as PDF files. This would make it easy to share results with stakeholders or archive them outside the application.

## 3. Duplicate Tests / Test Suites
Add a "Duplicate" action to tests and test suites so users can quickly create a copy as a starting point for a new test, rather than building from scratch.

## 4. User-Defined Custom Steps
Allow users to define their own custom step types (composite steps or macros) that combine multiple built-in steps into a reusable action. This would reduce repetition across tests.

## 5. Looping Capabilities
Add loop constructs to test definitions (e.g., repeat a step or group of steps N times, or loop until a condition is met). Useful for stress testing, data-driven testing, or repeating verification steps.

## 6. Test Variables
Allow defining, storing, and referencing variables during a test run. Variables could be set statically in the test YAML, captured from step results at runtime, or passed in as parameters. This enables dynamic tests and data-driven workflows.

## 7. Screenshot Comparison / Visual Regression
Compare screenshots against saved baseline images to automatically detect unexpected UI changes between runs.

## 8. Scheduled Test Runs
Run tests or suites on a cron schedule (e.g. nightly smoke tests) without manual intervention.

## 9. Retry Failed Tests
One-click re-run of only the failed steps or tests from a completed run, instead of re-running the entire test.

## 10. Test Tagging & Filtering
Tag tests (e.g. "smoke", "regression", "critical") and run filtered subsets from the UI.

## 11. Test Recorder
Record clicks and keystrokes on the desktop and auto-generate a test YAML from the recording.

## 12. Step Screenshot Preview
Show the screenshot from the last run inline in the test editor, so you can see what each step looked like.

## 13. Import / Export Tests
Export tests as shareable YAML bundles (with suites) and import them, for sharing across teams or machines.

## 14. Keyboard Shortcuts
Global hotkeys to start/stop runs without switching to the browser.

## 15. Trend Dashboard
Track pass/fail rates over time with charts showing test health trends.

## 16. Notification Hooks
Send results to Slack, email, or a webhook on test completion or failure.

## 17. Test Duration Tracking
Show how long each test and step takes over time to catch performance regressions.

## 18. File Comparison Assertion
Add a step type (e.g. `compare_file`) that compares a file produced during a test against a known-good reference file. Useful for testing export workflows — run the app, trigger an export (Save As, etc.), then assert the output matches the expected file. Should support exact match, and optionally ignore whitespace or specific lines.
