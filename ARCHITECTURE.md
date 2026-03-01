# Architecture

Technical reference for **wintest** — an AI-powered desktop UI testing tool for Windows.

---

## Project Structure

```
wintest/
├── config/             # Settings cascade, logging setup
├── core/               # AI vision, screen capture, actions, app management, recovery
├── steps/              # Self-contained step type definitions (auto-discovered)
├── tasks/              # Test schema, YAML loader, runner, validator, test suites
├── reporting/          # HTML + JSON report generation (Jinja2 templates)
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
        ├── routes/     # FastAPI routers (tests, test_suites, execution, reports, ws)
        ├── services/   # Business logic layer
        └── frontend/   # React SPA (built into dist/, served by FastAPI)

tests/                  # User-created test YAML files
test_suites/            # User-created test suite YAML files
reports/                # Generated reports (timestamped subdirectories)
config.yaml             # Global configuration overrides
```

---

## Vision Model

wintest uses **InternVL2-8B**, an 8-billion parameter multimodal vision-language model from OpenGVLab. It looks at screenshots and finds UI elements by natural language description.

### How It Works

1. A full-screen screenshot is captured via PyAutoGUI.
2. The image is resized to 448x448 (BICUBIC), normalized (ImageNet stats), and sent to the model.
3. The prompt asks the model to return the center coordinates of the described element on a **0–1000 normalized scale**.
4. Coordinates are parsed from the response via multi-pattern regex (handles `[x, y]`, `(x, y)`, and `x, y` formats).
5. Normalized coordinates are converted to actual screen pixels: `px = x / 1000 * screen_width`.

### Model Loading

- Loaded via HuggingFace `transformers` with **4-bit NF4 quantization** (BitsAndBytes), requiring a CUDA GPU.
- Three compatibility patches are applied for `transformers >= 4.50`: `GenerationMixin` injection, default `GenerationConfig`, and DynamicCache-to-legacy-tuple conversion.
- In web mode, the model is loaded lazily on first run and cached on `AppState` for reuse across runs.
- In CLI mode, a fresh instance is created per invocation.

### Coordinate System

The 0–1000 scale makes tests resolution-independent. A coordinate of `[500, 500]` always means "center of screen" regardless of actual resolution. `ScreenCapture.normalized_to_pixel()` handles the conversion.

---

## Step System

Steps are the atomic units of a test. Each step type is a self-contained Python module in `wintest/steps/`.

### Auto-Discovery

On import, `wintest/steps/_registry.py` scans the `steps/` package with `pkgutil.iter_modules`, imports every module whose name doesn't start with `_`, and collects any module-level `definition` attribute (a `StepDefinition` dataclass). No manual registration needed — drop a new file in `steps/` and it's available everywhere.

### Step Definition Structure

Each step module exports:
- `definition = StepDefinition(name, description, fields, validate, execute, is_runner_step)`
- `validate(step, step_num)` — returns a list of validation issue strings
- `execute(step, context)` — performs the action. Context is either the `Agent` (for most steps) or a `runner_ctx` dict (for runner-level steps like `launch_application`)

`FieldDef(name, field_type, required)` declares each step's parameters. The web UI reads these to dynamically render the correct form fields.

### Available Steps

| Step | Fields | How It Works |
|------|--------|-------------|
| `launch_application` | `app_path` (required), `app_title`, `wait_seconds` | Creates `ApplicationManager`, launches the process, sets up recovery. **Runner-level step.** |
| `click` | `target` (required) | AI vision locates the element, clicks it |
| `double_click` | `target` (required) | Same as click with double-click |
| `right_click` | `target` (required) | Same as click with right-click |
| `type` | `text` (required) | Types text via PyAutoGUI |
| `press_key` | `key` (required) | Presses a single key (e.g. `enter`, `tab`) |
| `hotkey` | `keys` (required, list, min 2) | Key combination (e.g. `["ctrl", "c"]`) |
| `scroll` | `scroll_amount` (required) | Mouse wheel scroll (positive=up, negative=down) |
| `wait` | `wait_seconds` (required) | Pauses execution |
| `verify` | `target` (required), `expected` | AI vision checks if element is visible. `expected: false` asserts it's NOT visible |

### Adding a New Step

Create a file in `wintest/steps/` (e.g. `my_step.py`):

```python
from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult

def validate(step, step_num):
    if not step.text:
        return [f"Step {step_num}: 'my_step' requires a 'text' field"]
    return []

def execute(step, agent):
    # Do something with agent.actions, agent.vision, etc.
    return StepResult(step=step, passed=True)

definition = StepDefinition(
    name="my_step",
    description="Does something custom",
    fields=[FieldDef("text", "string", required=True)],
    validate=validate,
    execute=execute,
)
```

Any new fields also need to be added to `Step` in `tasks/schema.py` and `StepModel` in `ui/web/models.py`.

---

## Configuration

Settings are resolved through a 4-level cascade:

```
1. Python defaults     (dataclass field defaults in settings.py)
2. config.yaml         (global overrides, loaded at startup)
3. Test YAML settings: (per-test overrides in the YAML file)
4. Per-step fields     (retry_attempts, retry_delay, timeout on individual steps)
```

### Settings Sections

| Section | Key Settings | Defaults |
|---------|-------------|----------|
| **Model** | `model_path`, `load_in_4bit`, `bnb_4bit_compute_dtype` | `OpenGVLab/InternVL2-8B`, `True`, `float16` |
| **Action** | `action_delay`, `failsafe`, `type_interval`, `coordinate_scale` | `0.5s`, `True`, `0.05s`, `1000` |
| **Retry** | `retry_attempts`, `retry_delay` | `3`, `2.0s` |
| **Timeout** | `step_timeout`, `test_timeout` | `60s`, `600s` |
| **Recovery** | `enabled`, `max_recovery_attempts`, `dismiss_dialog_keys` | `True`, `2`, `["escape"]` |
| **App** | `wait_after_launch`, `focus_delay`, `graceful_close_timeout` | `3.0s`, `0.3s`, `5.0s` |
| **Logging** | `level`, `log_file` | `INFO`, `None` |

---

## Test Execution

### Single Test Flow

1. `TestRunner` merges global settings with the test's `settings:` block.
2. Creates a timestamped report directory (`reports/<timestamp>_<name>/`).
3. Iterates steps in order. For each step:
   - Checks for cancellation signal and test-level timeout.
   - Focuses the application window (if one was launched).
   - **Runner-level steps** (e.g. `launch_application`): executed with a `runner_ctx` dict containing settings, agent, app manager, and recovery strategy.
   - **Agent-level steps**: executed via `Agent.execute_step()` in a daemon thread with per-step timeout.
   - On failure with recovery enabled: dismisses unexpected dialogs, re-focuses the app, retries the step once.
4. `fail_fast` (default `true`) stops on first failure.
5. After all steps: generates HTML + JSON report, closes the application.

### Test Suite Flow

`TestSuiteRunner` iterates `test_paths`, loads each test YAML, and runs it through a fresh `TestRunner`. Supports `fail_fast` (default `false` for suites) and a `cancel_check` callback.

### Cancellation

Cancellation is cooperative. The web UI sets a `threading.Event` on the `RunState`. The runner checks `progress_callback.is_cancelled()` before each step. Cancellation happens at step boundaries — a step in progress will complete before the run stops.

---

## Application Management

`ApplicationManager` handles the lifecycle of the desktop app under test using Win32 APIs via `ctypes`.

### Process Safety

All window operations are scoped to the launched process by PID. When `find_window_handle()` searches for windows, it calls `GetWindowThreadProcessId` and skips any window not owned by the launched process. This prevents accidentally interacting with or closing unrelated applications (e.g. VS Code, a browser) that might have a matching title substring.

### Lifecycle

| Method | What It Does |
|--------|-------------|
| `launch()` | Optionally kills existing instances, then `subprocess.Popen`. Waits for startup. |
| `focus()` | `ShowWindow(SW_RESTORE)` → `ShowWindow(SW_SHOWMAXIMIZED)` → `SetForegroundWindow` |
| `close()` | Sends `WM_CLOSE`, waits up to timeout, falls back to `force_close()` |
| `force_close()` | `taskkill /PID <pid> /T /F` (by PID when known, by process name as fallback) |
| `find_window_handle()` | `EnumWindows` with PID + title substring filter |

---

## Recovery Strategy

When a step fails and recovery is enabled, `RecoveryStrategy` attempts to restore the test environment:

1. Checks if the target application is already the foreground window (no-op).
2. If an unexpected window is in focus, presses dismiss keys (default: `Escape`) to close it.
3. Re-focuses the target application window.
4. Verifies the application is still running.
5. Retries the failed step once.

This handles common disruptions like unexpected dialogs, permission prompts, or the app losing focus.

---

## Web UI Architecture

### Backend (FastAPI)

The backend is a standard FastAPI application with:
- **Routes** (`routes/`): thin HTTP handlers that delegate to services.
- **Services** (`services/`): business logic — test CRUD, execution orchestration, report management.
- **State** (`state.py`): singleton `AppState` holding the vision model, run state, WebSocket clients, and a single-worker `ThreadPoolExecutor`.

Test execution runs in a background thread (via the executor) to avoid blocking the async event loop. The worker thread communicates back to WebSocket clients using `asyncio.run_coroutine_threadsafe` to bridge the sync/async boundary.

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
| `model_loading` | Model load begins | — |
| `model_loaded` | Model ready | — |
| `test_suite_started` | Suite begins | `suite_name`, `total_tests` |
| `test_suite_test_started` | Each test in suite begins | `test_index`, `test_name` |
| `test_suite_test_completed` | Each test in suite ends | `test_index`, `passed` |
| `test_suite_completed` | Suite ends | `passed`, `summary` |

On connect, clients receive a snapshot of the current run state (if any) so they can catch up mid-execution.

### Frontend (React)

**Stack:** React 19, TypeScript, Vite 7, React Router v7, Zustand 5, Axios, dnd-kit, Lucide React, i18next.

**State management:** Zustand stores for execution state, tests, test suites, and theme. The execution store processes WebSocket messages via a `handleWsMessage` switch that updates step results, status, and progress in real time.

**Key patterns:**
- The `useExecutionWebSocket` hook manages WebSocket connection and auto-reconnect (3s interval).
- Drag-and-drop step reordering uses `@dnd-kit/core` and `@dnd-kit/sortable`.
- Step editor forms are dynamically rendered based on `StepInfo.fields` metadata from the backend registry.
- Theme (light/dark/system) is persisted in `localStorage` and applied via a `data-theme` attribute on `<html>`.
- All UI strings are externalized to `locales/en.json` via i18next.

**Production build:** Vite builds into `frontend/dist/`. FastAPI serves the SPA statically, with a catch-all route returning `index.html` for client-side routing.

---

## Reporting

`ReportGenerator` produces two report formats per test run:

- **JSON** (`report.json`): machine-readable, contains all step results with coordinates, model responses, errors, and screenshot paths.
- **HTML** (`report.html`): human-readable, rendered with Jinja2. Shows a summary bar (total/passed/failed), and per-step cards with action badges, pass/fail status, duration, coordinates, model responses, and inline screenshots.

Reports are stored in `reports/<YYYY-MM-DD_HHMMSS>_<test_name>/` with a `screenshots/` subdirectory containing annotated PNGs (red crosshair + circle on click locations).

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

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| YAML for test definitions | Human-readable, no programming required, familiar from CI/CD tools |
| 0–1000 normalized coordinate scale | Resolution-independent — model output works on any screen size |
| Separate `verify` action type | Makes test intent explicit — different from clicking, supports negative assertions |
| ctypes for Win32 window management | Direct access to `user32.dll` without external dependencies (no pywin32 needed) |
| InternVL2-8B with 4-bit quantization | Best balance of vision capability and VRAM usage for consumer GPUs |
| FastAPI + React SPA | FastAPI integrates naturally with existing Python; React provides a rich interactive UI |
| WebSocket for execution streaming | Real-time step progress and screenshots without polling |
| File-based storage (no database) | YAML tests on disk, report directories — simple, portable, version-controllable |
| Single-worker ThreadPoolExecutor | Serializes GPU-bound test runs, prevents concurrent model access |
| Auto-discovered step registry | New step types are available everywhere by just adding a file — no manual wiring |
| PID-scoped window operations | Prevents accidentally closing unrelated applications during test execution |
| Cooperative cancellation via threading.Event | Safe cross-thread cancellation at step boundaries without corrupting state |
| Lazy model loading in web mode | Avoids slow startup — model loads on first run and stays cached |
| Daemon threads for step execution | Allows per-step timeout enforcement — daemon thread is abandoned on timeout |
| Atomic file writes for test YAML | Write to `.tmp` then `os.replace` to prevent corruption on crash |
| SPA catch-all route in FastAPI | Client-side routing works correctly — all non-API paths serve `index.html` |

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Model returns unparseable coordinates | High | Multi-pattern regex, prompt engineering, retry with delay |
| Low accuracy on custom UI elements | High | Allow rich natural language descriptions, prompt context about the UI |
| GPU memory pressure in long runs | Medium | Load model once, 4-bit quantization reduces VRAM |
| DPI scaling issues | Medium | Normalized coordinate system, test at various scaling levels |
| Accidental interaction with wrong window | Medium | PID-scoped window matching, pyautogui failsafe |
| Application not responding | Medium | Per-step and per-test timeouts, graceful close → force kill fallback |
| WebSocket disconnects during execution | Low | Auto-reconnect with 3s interval, state snapshot on connect for catch-up |
