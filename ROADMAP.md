# Roadmap

Implementation plan for wintest — an AI-powered desktop UI testing tool.

Each phase builds on the previous one and is independently useful.

---

## Phase 1 — Core Engine Extraction ✅

**Goal:** Refactor the monolithic `run.py` into a modular package and make coordinate extraction reliable.

### Deliverables

- **`wintest/core/vision.py`** — `VisionModel` class
  - Model loading with 4-bit quantization
  - All transformers compatibility patches encapsulated
  - `find_element(screenshot, element_name)` → returns parsed coordinates
  - `parse_coordinates(response_text)` → multi-pattern regex extraction
- **`wintest/core/screen.py`** — `ScreenCapture` class
  - Screenshot capture via pyautogui
  - `normalized_to_pixel(x, y)` → convert 0-1000 scale to actual screen pixels
- **`wintest/core/actions.py`** — `ActionExecutor` class
  - `click(x, y)`, `type_text(text)`, `press_key(key)`, `hotkey(*keys)`, `scroll(amount)`
  - Configurable delays and pyautogui failsafe

---

## Phase 2 — Agent Loop + Task Definition ✅

**Goal:** Build the agent loop and allow users to define multi-step test tasks in YAML.

### Deliverables

- **`wintest/core/agent.py`** — `Agent` class
  - Core loop: screenshot → ask model → parse → execute action → verify
  - Retry logic with configurable attempts and delay
- **`wintest/tasks/schema.py`** — data models
  - `Step` dataclass with action type, target, text, keys, expected result
  - `TaskDefinition` dataclass with name, steps, application config, settings
  - 9 action types: click, double_click, right_click, type, press_key, hotkey, scroll, wait, verify
- **`wintest/tasks/loader.py`** — YAML parser
- **`wintest/tasks/runner.py`** — `TaskRunner` class
- **`examples/notepad_test.yaml`** — example task file

---

## Phase 3 — Reporting ✅

**Goal:** Generate structured test reports so users can understand what happened during a test run.

### Deliverables

- **`wintest/reporting/reporter.py`** — `ReportGenerator` class
  - JSON report with full structured data
  - HTML report with annotated screenshots (crosshair on click location)
  - Console summary with colored pass/fail indicators
- **`wintest/reporting/templates/`** — Jinja2 HTML report templates

---

## Phase 4 — Configuration, Recovery, App Management ✅

**Goal:** Production-grade configuration, error recovery, and application lifecycle management.

### Deliverables

- **`wintest/config/settings.py`** — global configuration loaded from `config.yaml`
- **`wintest/core/app_manager.py`** — `ApplicationManager` class
  - Launch, focus, check, and close applications via win32gui
- **`wintest/core/recovery.py`** — `RecoveryStrategy` class
  - Dismiss unexpected dialogs, re-focus windows
- Step-level and task-level timeout enforcement

---

## Phase 5 — CLI Interface ✅

**Goal:** A polished command-line interface.

### Deliverables

- **`wintest/ui/cli.py`** — Click-based CLI
  - `wintest run <task.yaml>` — execute a test task, generate report
  - `wintest validate <task.yaml>` — check task file for errors
  - `wintest init` — generate a template task file
  - `wintest list-actions` — show available action types
  - `wintest interactive` — natural language commands executed live
- **`pyproject.toml`** — package config with `wintest` entry point
- Progress display during execution
- Colored terminal output

---

## Phase 6 — Web UI ✅

**Goal:** Browser-based interface for creating tasks, running them, watching live execution, and browsing reports.

### Deliverables

- **FastAPI backend** (`wintest/ui/web/`)
  - REST API for task CRUD, execution control, and report browsing
  - WebSocket for live execution streaming (step progress + screenshots)
  - ThreadPoolExecutor for GPU-bound task execution
  - Lazy model loading (loads on first run, stays loaded)
- **React frontend** (`wintest/ui/web/frontend/`)
  - Dashboard — task list, model status, recent reports
  - Task Editor — form-based editor with drag-and-drop step reordering
  - Execution Viewer — live step progress and screenshots via WebSocket
  - Report Browser — step-by-step detail with screenshots
  - Zustand state management, Axios HTTP client, dark theme
- **`wintest web`** CLI command to start the server

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **YAML for task definitions** | Human-readable, no programming required, familiar from CI/CD tools |
| **0-1000 normalized coordinate scale** | Resolution-independent — model output works on any screen size |
| **Separate `verify` action type** | Makes test intent explicit — different model queries, supports negative verification |
| **pywin32 for window management** | pyautogui handles input but can't manage windows. win32gui is the standard on Windows |
| **InternVL2-8B with 4-bit quantization** | Best balance of capability and VRAM usage for consumer GPUs |
| **FastAPI + React SPA** | FastAPI integrates naturally with existing Python code; React provides a rich interactive UI |
| **WebSocket for execution streaming** | Real-time step progress and screenshots without polling |
| **File-based storage** | YAML tasks on disk, report directories — no database required |

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
