# Roadmap

Detailed implementation plan for turning the current proof-of-concept into a full AI-powered desktop UI testing tool.

Each phase builds on the previous one and is independently useful.

---

## Phase 1 — Core Engine Extraction

**Goal:** Refactor the monolithic `run.py` into a modular package and make coordinate extraction reliable.

### Deliverables

- **`wintest/core/vision.py`** — `VisionModel` class
  - Model loading with 4-bit quantization (extracted from `run.py`)
  - All transformers compatibility patches encapsulated
  - `find_element(screenshot, element_name)` → returns parsed coordinates
  - `parse_coordinates(response_text)` → multi-pattern regex extraction of `[x, y]` from model output
- **`wintest/core/screen.py`** — `ScreenCapture` class
  - Screenshot capture via pyautogui
  - `normalized_to_pixel(x, y)` → convert 0-1000 scale to actual screen pixels
- **`wintest/core/actions.py`** — `ActionExecutor` class
  - `click(x, y)`, `type_text(text)`, `press_key(key)`, `hotkey(*keys)`, `scroll(amount)`
  - Configurable delays and pyautogui failsafe

### Testable outcome

Run a script that finds a UI element by name, parses the coordinates, and **clicks on it** — the first end-to-end action.

### Key risk

Coordinate parsing — the model returns coordinates in varied formats. Mitigate with multi-pattern regex, 0-1000 range validation, and logging every raw response for analysis.

---

## Phase 2 — Agent Loop + Task Definition

**Goal:** Build the agent loop and allow users to define multi-step test tasks in YAML.

### Deliverables

- **`wintest/core/agent.py`** — `Agent` class
  - Core loop: screenshot → ask model → parse → execute action → verify
  - Retry logic: if element not found, retry N times with delay
- **`wintest/tasks/schema.py`** — data models
  - `Step` dataclass with action type, target, text, keys, expected result
  - `TaskDefinition` dataclass with name, steps, application config, settings
  - Action types: `click`, `double_click`, `right_click`, `type`, `press_key`, `hotkey`, `scroll`, `wait`, `verify`
- **`wintest/tasks/loader.py`** — YAML parser
- **`wintest/tasks/runner.py`** — `TaskRunner` class
  - Executes all steps in sequence
  - Fail-fast option (stop on first failure)
- **`examples/notepad_test.yaml`** — example task file

### Task file format

```yaml
name: "Notepad Basic Test"
application:
  path: "notepad.exe"
  wait_after_launch: 3

steps:
  - action: click
    target: "File menu"
    description: "Open the File menu"

  - action: type
    text: "Hello, World!"
    description: "Type test text"

  - action: verify
    target: "text area containing 'Hello, World!'"
    description: "Verify text was typed"

settings:
  retry_attempts: 3
  retry_delay: 2
```

### Testable outcome

Write a YAML file, run it, and watch the AI launch Notepad, type text, and verify it appeared. First real end-to-end test scenario.

### New dependencies

`pyyaml`

---

## Phase 3 — Reporting

**Goal:** Generate structured test reports so users can understand what happened during a test run.

### Deliverables

- **`wintest/reporting/models.py`** — `StepResult` and `TaskResult` dataclasses
  - Per-step: pass/fail, coordinates, screenshot, model response, duration
  - Per-task: aggregate pass/fail, timing, summary stats
- **`wintest/reporting/reporter.py`** — `ReportGenerator` class
  - JSON report with full structured data
  - HTML report with embedded annotated screenshots (crosshair on click location)
  - Console summary with colored pass/fail indicators
- **`wintest/reporting/logger.py`** — structured logging setup

### Testable outcome

Run a task and open an HTML report in a browser showing each step with screenshots, what the AI saw, where it clicked, and whether it passed.

### New dependencies

`jinja2`

---

## Phase 4 — Configuration, Recovery, App Management

**Goal:** Make the tool production-grade with proper configuration, error recovery, and application lifecycle management.

### Deliverables

- **`wintest/config/settings.py`** — global configuration
  - Model settings (path, quantization, max tokens)
  - Action settings (delays, retries, timeouts)
  - Loadable from `config.yaml`
- **`wintest/core/app_manager.py`** — `ApplicationManager` class
  - Launch application by path
  - Focus window by title (via win32gui)
  - Check if process is running
  - Close application (graceful or force)
- **`wintest/core/recovery.py`** — `RecoveryStrategy` class
  - Dismiss unexpected dialogs (press Escape)
  - Re-focus target application window
  - Common recovery patterns
- Step-level and task-level timeout enforcement

### Testable outcome

Launch an app, run a test, handle an unexpected dialog mid-test, and close the app — all automatically.

### New dependencies

`pywin32`

---

## Phase 5 — CLI Interface

**Goal:** A polished command-line interface so users don't need to edit Python code.

### Deliverables

- **`wintest/ui/cli.py`** — Click-based CLI
  - `wintestrun <task.yaml>` — execute a test task, generate report
  - `wintestvalidate <task.yaml>` — check task file for errors
  - `wintestinit` — generate a template task file
  - `wintestlist-actions` — show available action types
  - `wintestinteractive` — type natural language commands, AI executes them live
- **`pyproject.toml`** — package config with `wintest` entry point
- Progress display during execution (step N/M, current action)
- Colored terminal output

### Testable outcome

`pip install -e .` then `wintestrun examples/notepad_test.yaml` from any directory.

### New dependencies

`click`, `colorama`

---

## Phase 6 — Web UI + Advanced Features

**Goal:** Graphical interface for non-developers and advanced testing capabilities.

### Deliverables

- **`wintest/ui/web/app.py`** — FastAPI backend
  - REST API for running tasks, checking status, viewing results
  - WebSocket for live screenshot streaming during execution
- **Web frontend** — HTML/JS at `localhost:8080`
  - Visual task editor (create/edit steps, drag-and-drop reordering)
  - Live execution viewer (watch the agent in real-time)
  - Screenshot-based authoring (click on a screenshot, AI names the element)
  - Result dashboard with historical trends
- Test suites (run multiple task files, aggregate results)
- Conditional steps (if element X visible, do Y; otherwise Z)
- Parameterized tasks (same task with different input data)

### Testable outcome

Open browser, create a test visually, run it, watch live, review results.

### New dependencies

`fastapi`, `uvicorn`, `websockets`

---

## Project Structure (End State)

```
wintest/
    run.py                    # Entry point (thin launcher)
    requirements.txt
    pyproject.toml
    README.md
    ROADMAP.md

    wintest/       # Main package
        core/
            vision.py         # Model loading, inference, coordinate parsing
            screen.py         # Screenshot capture, coordinate mapping
            actions.py        # Click, type, scroll, key press
            agent.py          # Agent loop: screenshot → analyze → act → verify
            app_manager.py    # Launch, focus, close applications
            recovery.py       # Error recovery strategies
        tasks/
            schema.py         # Step, TaskDefinition data models
            loader.py         # YAML task parser
            runner.py         # Task execution engine
        reporting/
            models.py         # StepResult, TaskResult
            logger.py         # Structured logging
            reporter.py       # HTML/JSON report generation
        config/
            settings.py       # Global configuration
        ui/
            cli.py            # CLI interface
            web/
                app.py        # FastAPI backend
                static/
                templates/

    examples/                 # Example YAML task files
    tests/                    # Unit and integration tests
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **YAML for task definitions** | Human-readable, no programming required, familiar from CI/CD tools. JSON is too verbose, Python DSL requires coding knowledge |
| **0-1000 normalized coordinate scale** | Resolution-independent — model output works on any screen size |
| **Separate `verify` action type** | Makes test intent explicit. "Verify X is visible" is different from "click X" — different model queries, supports negative verification |
| **pywin32 for window management** | pyautogui handles input but can't manage windows. win32gui is the standard for window enumeration and focus on Windows |
| **Phase-gated approach** | Each phase is independently useful. No need to build everything before getting value |

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Model returns unparseable coordinates | High | Multi-pattern regex, prompt engineering, retry with rephrased query |
| Low accuracy on custom UI elements | High | Allow rich element descriptions, prompt context about the app's UI |
| GPU memory pressure in long runs | Medium | Load model once, monitor VRAM usage |
| DPI scaling issues | Medium | Test at 100%, 125%, 150% scaling |
| Accidental clicks on wrong elements | Medium | pyautogui failsafe enabled, coordinate validation |
| Application not responding | Medium | Timeout enforcement, process kill as last resort |
