# Architecture

Technical reference for **wintest** — an automated UI testing tool for Windows desktop applications.

---

## Overview

wintest drives a Windows desktop GUI the way a user would: clicks at pixel coordinates, typed text, key presses, scroll events. Tests are recorded by clicking through the target application in a web-based Test Builder and replayed later to catch regressions.

The recording step produces YAML — human-readable, version-controllable, and editable by hand — stored inside a **workspace** directory that the user chooses. That workspace also holds test suites, scheduled pipelines, baselines, and historical run reports.

A separate **scheduler** process reads pipeline YAML files and fires runs at the configured day and time using the same execution code the CLI and web UI use.

Coordinate-based clicking is the primary mode. An optional AI vision model can locate an element by plain-language description when coordinates aren't a good fit — but tests that don't need it never load the model.

---

## Project Structure

```
wintest/
├── __main__.py         # `python -m wintest ...` entry point (scheduler uses this)
├── config/             # Settings cascade, workspace paths, logging setup
├── core/               # Screen capture, actions, app management, recovery
│   └── vision/         # Pluggable AI vision models (ShowUI, Qwen2.5-VL)
├── steps/              # Self-contained step type definitions (auto-discovered)
├── tasks/              # Test / suite / pipeline schemas + loaders + runners
├── reporting/          # JSON report generation
├── scheduler/          # Background scheduler process (engine, PID file, startup)
└── ui/
    ├── cli.py          # Click-based CLI entry point
    ├── console.py      # Colored terminal output helpers
    ├── interactive.py  # Live REPL mode
    ├── progress.py     # CLI progress callback
    ├── templates.py    # `wintest init` YAML template
    └── web/
        ├── app.py      # FastAPI application factory
        ├── server.py   # Uvicorn launcher + auto browser open
        ├── state.py    # Global AppState singleton
        ├── models.py   # Pydantic request/response models
        ├── routes/     # FastAPI routers
        ├── services/   # Business logic layer
        └── frontend/   # React SPA (built into dist/, served by FastAPI)

scripts/
└── generate_demo_data.py   # Populate a workspace with demo tests/suites/pipelines/reports

<workspace>/              # User-chosen directory, path stored in %LOCALAPPDATA%\wintest\workspace.json
├── tests/                # Test YAML files
├── test_suites/          # Suite YAML files
├── pipelines/            # Pipeline YAML files
├── baselines/            # Reference images / files for assertions
├── reports/              # Timestamped run reports
└── config/               # config.yaml, saved_apps.json
```

---

## Workspace Management

All user data lives inside a workspace directory chosen by the user at first launch. The chosen path is stored in `%LOCALAPPDATA%\wintest\workspace.json` so every wintest process (web UI, CLI, scheduler) reads from the same place.

Every backend module that touches a user-data path routes through `wintest/config/workspace.py`, which exposes helpers like `tests_dir()`, `suites_dir()`, `pipelines_dir()`, `baselines_dir()`, `reports_dir()`, and `config_file()`. Nothing hardcodes paths.

A `--workspace` CLI flag overrides the saved preference for one invocation (used when demoing against a dedicated workspace without changing the user's global setting).

---

## Test Execution

### Step System

Steps are the atomic units of a test. Each step type is a self-contained Python module in `wintest/steps/`.

**Auto-discovery.** On import, `wintest/steps/_registry.py` scans the `steps/` package with `pkgutil.iter_modules`, imports every module whose name doesn't start with `_`, and collects any module-level `definition` attribute (a `StepDefinition` dataclass). No manual registration — drop a new file in `steps/` and it's available everywhere.

**Step module contract:**
- `definition = StepDefinition(name, description, fields, validate, execute, is_runner_step)`
- `validate(step, step_num)` — returns a list of validation issue strings
- `execute(step, context)` — performs the action. Context is either the `Agent` (for most steps) or a `runner_ctx` dict (for runner-level steps like `launch_application` and `loop`)

`FieldDef(name, field_type, required)` declares each step's parameters. The web UI reads these to dynamically render the correct form fields.

### Available Steps

| Step | Category | Purpose |
|------|----------|---------|
| `launch_application` | Runner | Launches an app, installs recovery strategy, manages window focus |
| `click` / `double_click` / `right_click` | Action | Clicks at captured coordinates (`click_x`/`click_y`), or optionally uses AI to locate an element by `target` description |
| `type` | Action | Types text at the current cursor position |
| `press_key` | Action | Presses a single key (enter, tab, escape, arrows, f-keys...) |
| `hotkey` | Action | Presses a key combination (e.g. `["ctrl", "s"]`) |
| `scroll` | Action | Mouse wheel scroll |
| `wait` | Action | Pauses execution; sleeps in 0.5s chunks so cancellation is prompt |
| `set_variable` | Runner | Assigns a value to a variable in the run's variable store |
| `loop` | Runner | Jumps back to an earlier step N times (do/while semantics) |
| `verify` | Validation | Optional AI check: does a described element exist on screen? |
| `verify_screenshot` | Validation | Crops a region and compares it to a baseline image (pixel similarity with threshold) |
| `compare_saved_file` | Validation | Watches a directory for a new file and compares it to a baseline (exact bytes or image similarity) |

Validation steps are the ones that intentionally produce pass/fail signals. Everything else only fails when something unexpected breaks.

### Single Test Flow

1. `TestRunner` merges global settings with the test's `settings:` block.
2. Creates a timestamped report directory (`<workspace>/reports/<timestamp>_<name>/`).
3. Snapshots any directories referenced by `compare_saved_file` steps so "new file" detection can work later.
4. Iterates steps using an explicit index (so `loop` can jump back). For each step:
   - Checks for cancellation signal and test-level timeout.
   - Resolves `{{variable}}` placeholders in the step's string fields.
   - Focuses the application window (if one was launched).
   - **Runner-level steps** execute with a `runner_ctx` dict containing settings, agent, app manager, recovery strategy, variable store, progress callback.
   - **Agent-level steps** execute via `Agent.execute_step()` in a daemon thread with per-step timeout.
   - On failure with recovery enabled: dismisses unexpected dialogs, re-focuses the app, retries the step once.
5. After all steps: generates a JSON report; closes the application.

### Test Suite Flow

`TestSuiteRunner` iterates `test_paths`, loads each test YAML, and runs it through a fresh `TestRunner`. Supports `fail_fast` (default `false` for suites) and a `cancel_check` callback.

### Variables and Loops

- Variables live in a `VariableStore` attached to the run context. They're seeded from the test's `variables:` block and can be mutated by `set_variable` steps.
- `{{placeholder}}` syntax works in any string field: `target`, `text`, `description`, `key`, `file_path`, etc. The runner resolves them at step start via regex substitution.
- `loop` steps produce do/while semantics: when reached, the runner sets its step index back to `loop_target` and increments a hidden counter until `repeat` iterations have completed. A `{{loop_index}}` variable is automatically available to steps inside the loop.

### Cancellation

Cooperative. The web UI sets a `threading.Event` on the `RunState`. The runner and `wait` step both check this flag; cancellation takes effect at step boundaries or within half a second during waits.

---

## AI Vision (Optional)

The pluggable vision layer is a **secondary** path, used when a step specifies a `target` description instead of coordinates. Most tests are recorded via the Test Builder and use coordinates throughout.

### Pluggable Factory

`wintest/core/vision/__init__.py` is a factory that dispatches based on `settings.model.model_path`:

| Model | Class | Notes |
|-------|-------|-------|
| `showlab/ShowUI-2B` | `ShowUIModel` | Default. Small (2B), fast, decent grounding. |
| `Qwen/Qwen2.5-VL-{2B,3B,7B}-Instruct` | `Qwen25VLModel` | Stronger reasoning, more VRAM. Returns bounding boxes. |

Any model path that's not in the registry falls through to ShowUI. Adding a new model means writing one module in `wintest/core/vision/` and adding an entry to `_MODEL_REGISTRY`.

### Loading

- Loaded via HuggingFace `transformers` with **4-bit NF4 quantization** (BitsAndBytes), requiring a CUDA GPU.
- Coordinates are returned by the model in one of two formats (point or bounding box) and normalized to a **0–1000 scale** that's independent of screen resolution. `ScreenCapture.normalized_to_pixel()` does the conversion.
- **Lazy-loaded everywhere**: the web UI, CLI, and scheduler all skip model loading if no step in the current test/suite requires vision. This is checked by walking the loaded steps and seeing if any are click/verify steps without coordinates.

### Where we're going

AI-driven clicking is unreliable enough right now that it's not the default — coordinate mode is. The current thinking for improving this track:

- **Hybrid approach**: use AI for verification steps (where small miss-localizations don't break anything) while coordinate clicking handles actions.
- **Data-driven assertions**: a `read_text` step that extracts text from the screen into a variable, so tests can assert on real values instead of just "did an element appear".
- **Better models as they ship**: the registry makes swapping in a new model trivial.

Tracked in `TODO.md` under *Vision Model Accuracy*.

---

## Pipelines and Scheduler

Pipelines are scheduled test runs. Each pipeline YAML specifies: name, enabled flag, target (test *or* suite file), schedule days, schedule time.

The scheduler is a **separate long-running process** that triggers runs — the web UI doesn't do it.

### Why a separate process

UI tests need an interactive desktop session (they move the mouse, click windows, etc.). Windows Services run in Session 0, which has no desktop, so a Windows Service won't work. The scheduler is instead registered as a **Windows startup program** (a `.vbs` launcher in the user's Startup folder) so it auto-starts in the user's session on login. The machine must stay logged in.

### Engine loop

`wintest/scheduler/engine.py` runs this loop:

```
every second:
  if stop flag file exists -> shut down
  if it's been 30s since last tick -> do a tick

tick:
  load all pipelines in workspace/pipelines/
  for each enabled pipeline where today is a scheduled day and current time matches:
    skip if already fired at this minute today
    write current_run.json (what's running, when it started)
    execute the referenced test or suite using TestRunner / TestSuiteRunner
    clear current_run.json; append to scheduler_runs.json
```

### Process lifecycle files

All in `%LOCALAPPDATA%\wintest\`:

| File | Purpose |
|------|---------|
| `scheduler.pid` | Scheduler PID + start timestamp. Presence + live PID check = "running". |
| `scheduler.stop` | Sentinel file. Scheduler polls for it every second and shuts down cleanly when found. |
| `scheduler_current_run.json` | What pipeline is currently executing (if any). Cleared when the run finishes. |
| `scheduler_runs.json` | Per-pipeline history: last-fired date/time, last-run pass/fail. Used for dedupe and for the UI's "last run" column. |

### Start / stop

- Start: `wintest scheduler` (CLI) or `POST /api/pipelines/scheduler/start` (web UI). The web UI spawns `pythonw -m wintest scheduler` with `CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP` so no console window appears and the process outlives the web server.
- Stop: `wintest scheduler --stop` or `POST /api/pipelines/scheduler/stop`. Writes the stop flag, waits up to 5 seconds, falls back to `taskkill /F`.
- Status: `wintest scheduler --status` or `GET /api/pipelines/scheduler-status`.
- Install at login: `wintest scheduler --install-startup` drops a `.vbs` launcher in the user's Startup folder.

### Concurrency

Only one scheduler instance can run at a time (enforced via the PID file). Within a single instance, runs are serialized — two pipelines that fire at the same minute execute one after the other, since only one UI test can own the desktop.

---

## Configuration

Settings are resolved through a 4-level cascade:

```
1. Python dataclass defaults      (wintest/config/settings.py)
2. <workspace>/config/config.yaml (global overrides, loaded at startup)
3. Test YAML `settings:` block    (per-test overrides)
4. Per-step fields                (retry_attempts, retry_delay, timeout)
```

### Settings Sections

| Section | Key Settings | Defaults |
|---------|-------------|----------|
| **Model** | `model_path`, `load_in_4bit`, `bnb_4bit_quant_type` | `showlab/ShowUI-2B`, `True`, `"nf4"` |
| **Action** | `action_delay`, `failsafe`, `type_interval`, `coordinate_scale` | `0.5s`, `True`, `0.05s`, `1000` |
| **Retry** | `retry_attempts`, `retry_delay` | `3`, `2.0s` |
| **Timeout** | `step_timeout`, `test_timeout` | `60s`, `600s` |
| **Recovery** | `enabled`, `max_recovery_attempts`, `dismiss_dialog_keys` | `True`, `2`, `["escape"]` |
| **App** | `wait_after_launch`, `focus_delay`, `graceful_close_timeout` | `3.0s`, `0.3s`, `5.0s` |
| **Logging** | `level`, `log_file` | `INFO`, `None` |

---

## Application Management

`ApplicationManager` handles the lifecycle of the desktop app under test using Win32 APIs via `ctypes`.

### Process Safety

All window operations are scoped to the launched process by PID. When `find_window_handle()` searches for windows, it calls `GetWindowThreadProcessId` and skips any window not owned by the launched process. This prevents accidentally interacting with or closing unrelated applications that might have a matching title substring.

### Lifecycle

| Method | What It Does |
|--------|-------------|
| `launch()` | Optionally kills existing instances, then `subprocess.Popen`. Waits for startup. |
| `focus()` | `ShowWindow(SW_RESTORE)` → `ShowWindow(SW_SHOWMAXIMIZED)` → `SetForegroundWindow` |
| `close()` | Sends `WM_CLOSE`, waits up to timeout, falls back to `force_close()` |
| `force_close()` | `taskkill /PID <pid> /T /F` (by PID when known, by process name as fallback) |
| `find_window_handle()` | `EnumWindows` with PID + title substring filter |

### Recovery Strategy

When a step fails and recovery is enabled, `RecoveryStrategy` attempts to restore the test environment:

1. Checks if the target application is already the foreground window (no-op).
2. If an unexpected window is in focus, presses dismiss keys (default: `Escape`) to close it.
3. Re-focuses the target application window.
4. Verifies the application is still running.
5. Retries the failed step once.

Handles common disruptions like unexpected dialogs, permission prompts, or the app losing focus.

---

## Web UI Architecture

### Backend (FastAPI)

- **Routes** (`ui/web/routes/`): thin HTTP handlers that delegate to services. Current: `tests`, `test_suites`, `pipelines`, `execution`, `builder`, `reports`, `baselines`, `files`, `saved_apps`, `settings`, `ws`.
- **Services** (`ui/web/services/`): business logic — CRUD, execution orchestration, report management, pipeline + scheduler control.
- **State** (`state.py`): singleton `AppState` holding the vision model (when loaded), run state, WebSocket clients, and a single-worker `ThreadPoolExecutor`.

Test execution runs in a background thread (via the executor) to avoid blocking the async event loop. The worker thread communicates back to WebSocket clients using `asyncio.run_coroutine_threadsafe`.

### WebSocket Protocol

The server broadcasts JSON messages to all connected clients. Message types:

| Type | When | Key Data |
|------|------|----------|
| `run_started` | Test begins | `run_id`, `test_name`, `total_steps` |
| `step_started` | Before each step | `step_num`, `label` |
| `step_completed` | After each step | `passed`, `error`, `screenshot_base64`, `coordinates` |
| `run_completed` | All steps done | `passed`, `summary` |
| `run_failed` | Unhandled error | `error` |
| `run_cancelled` | User cancelled | — |
| `model_loading` / `model_loaded` | AI model load begins / ends | — |
| `test_suite_started` / `..._test_started` / `..._test_completed` / `..._completed` | Suite run progress | `test_index`, `test_name`, `passed` |
| `watching_directory` / `watching_directory_done` | `compare_saved_file` step | `directory` |
| `log` | Logger output for the live console | `level`, `message`, `timestamp` |

On connect, clients receive a snapshot of the current run state so they can catch up mid-execution.

### Frontend (React)

**Stack:** React 19, TypeScript, Vite 7, React Router v7, Zustand 5, Axios, dnd-kit, Lucide React, recharts, i18next.

**State management:** Zustand stores for execution state, tests, test suites, pipelines, theme. The execution store processes WebSocket messages via a `handleWsMessage` switch that updates step results, status, and progress in real time.

**Key patterns:**
- `useExecutionWebSocket` hook manages WebSocket connection and auto-reconnect (3s interval).
- Drag-and-drop step reordering uses `@dnd-kit/core` + `@dnd-kit/sortable` with stable IDs.
- Step editor forms are dynamically rendered based on `StepInfo.fields` metadata from the backend registry.
- The Test Builder captures clicks on a screenshot (normalized 0–1 coordinates) and auto-re-enters pick mode after each click so the user can keep clicking without touching wintest.
- Theme (light/dark/system) is persisted in `localStorage` and applied via a `data-theme` attribute.
- All UI strings are externalized to `locales/en.json` via i18next.
- `react-router-dom`'s `useBlocker` prompts for unsaved changes when leaving editor pages.

**Production build:** Vite builds into `frontend/dist/`. FastAPI serves the SPA statically, with a catch-all route returning `index.html` for client-side routing.

---

## Reporting

`ReportGenerator` produces JSON per test run (`report.json`): machine-readable, contains all step results with coordinates, model responses, errors, and screenshot paths.

Reports are stored in `<workspace>/reports/<YYYY-MM-DD_HHMMSS>_<test_name>/` with a `screenshots/` subdirectory containing annotated PNGs (red crosshair + circle on click locations).

The web UI renders these reports client-side. PDF export (`fpdf2`) is available from the Results page.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `wintest run <test.yaml>` | Run a test, print progress, generate report. Exit code 0/1. |
| `wintest run-test-suite <suite.yaml>` | Run a test suite with per-test results. |
| `wintest validate <test.yaml>` | Validate a test file without running it (no GPU needed). |
| `wintest init [output]` | Generate a starter test YAML template. |
| `wintest list-steps` | Show all registered step types with fields. |
| `wintest interactive` | Live REPL — type natural language commands and execute immediately. |
| `wintest web` | Start the web UI server and open the browser. |
| `wintest scheduler` | Run the pipeline scheduler (long-running). |
| `wintest scheduler --install-startup` / `--uninstall-startup` | Register / unregister auto-start at Windows login. |
| `wintest scheduler --stop` | Ask a running scheduler to shut down. |
| `wintest scheduler --status` | Check whether the scheduler is running. |

Both `wintest <command>` (console script) and `python -m wintest <command>` work. The scheduler spawns itself using the `-m` form via `pythonw.exe` so no console window appears.

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Coordinate-based clicking as primary** | AI grounding accuracy on custom UIs was unreliable; coordinates are fast, deterministic, and good enough since the Builder records them automatically |
| **Pluggable vision model factory** | AI models improve quickly; swapping one in is a single file + registry entry |
| **Lazy AI-model loading** | Tests that don't use AI (the majority) skip the multi-second model load entirely |
| YAML for test definitions | Human-readable, no programming required, version-controllable |
| 0–1000 normalized coordinate scale | Resolution-independent — works on any screen size |
| Workspace-based file layout | Single configurable root; all wintest processes read the same paths |
| **Separate scheduler process** | Windows Services can't access the desktop; a startup-folder program runs in the user's session and can drive UI tests |
| **Stop flag file + PID file** | Cross-process scheduler control without needing an IPC channel; signals don't work reliably for detached pythonw processes |
| ctypes for Win32 window management | Direct access to `user32.dll` without external dependencies |
| FastAPI + React SPA | FastAPI integrates naturally with existing Python; React provides a rich interactive UI |
| WebSocket for execution streaming | Real-time step progress and screenshots without polling |
| File-based storage (no database) | YAML tests on disk, report directories — simple, portable, version-controllable |
| Single-worker ThreadPoolExecutor | Serializes test runs, prevents concurrent desktop access |
| Auto-discovered step registry | New step types are available everywhere by just adding a file — no manual wiring |
| PID-scoped window operations | Prevents accidentally closing unrelated applications during test execution |
| Cooperative cancellation via threading.Event | Safe cross-thread cancellation at step boundaries without corrupting state |
| Daemon threads for step execution | Per-step timeout enforcement — daemon thread is abandoned on timeout |
| Atomic file writes (tmp → rename) | Prevents corruption of YAML files on crash during save |
| SPA catch-all route in FastAPI | Client-side routing works correctly — all non-API paths serve `index.html` |

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Coordinates drift when target app's UI layout changes | High | Tests become brittle under UI redesigns; mitigated by keeping tests scoped to stable UIs and by using `verify_screenshot` / `compare_saved_file` assertions that detect drift loudly |
| Scheduler machine logs out / locks | High | UI automation requires an interactive desktop session. Documented; presenting auto-logon as the deployment pattern for unattended test machines |
| Multiple scheduler instances running | Medium | PID file check prevents starting a second instance; `--status` command to diagnose |
| Scheduler crashes silently | Medium | PID file is removed on clean exit; stale PID is detected on next start-attempt. Logs go to the scheduler's own log file |
| Accidental interaction with wrong window | Medium | PID-scoped window matching, pyautogui failsafe |
| Application not responding | Medium | Per-step and per-test timeouts, graceful close → force kill fallback |
| AI model returns unparseable coordinates | Medium (AI path only) | Multi-pattern regex, prompt engineering, retry with delay |
| DPI scaling / multi-monitor setups | Medium | Normalized coordinate system; single-monitor only — primary display is captured |
| WebSocket disconnects during execution | Low | Auto-reconnect with 3s interval; state snapshot on connect for catch-up |
