[![Tests](https://github.com/justinswork/WinTest/actions/workflows/tests.yml/badge.svg)](https://github.com/justinswork/WinTest/actions/workflows/tests.yml)

# wintest

**Automated UI testing for Windows desktop applications.**

Record tests by clicking through your application, replay them to catch regressions, and schedule them to run automatically. wintest drives any Windows GUI — office suites, engineering tools, in-house apps — without needing source access, accessibility APIs, or DOM selectors.

Think of it as Selenium/Playwright, but for **any desktop application**.

---

## What you can do

- **Build tests visually.** Open the Test Builder, launch your app, and click through it. wintest captures each click as a test step with pixel-exact coordinates.
- **Assert on real output.** Compare files your app produces against saved baselines (exact byte match or pixel similarity for images), or compare a region of the screen against a saved screenshot.
- **Group and schedule.** Organize tests into suites, then create pipelines that run a test or suite on the days and times you choose.
- **Rerun and inspect.** Every run produces a report with per-step screenshots, pass/fail status, and timing. Export to PDF for sharing.
- **See what's trending.** The Trends dashboard shows pass/fail history and duration over time for each test.

---

## How it works

1. **Record.** In the web UI, open the Test Builder and launch your application. Every click you make in the app's window becomes a test step. Add waits, keystrokes, typed text, and assertions alongside the clicks.
2. **Replay.** Run the test and wintest replays your clicks at the captured coordinates, types the recorded text, and checks the assertions.
3. **Report.** Each step produces a screenshot and a pass/fail result. Failures show exactly what went wrong, including file diffs and screenshot diffs.
4. **Schedule.** Create a pipeline to run a test or suite on a recurring schedule (e.g., nightly at 10pm). A background scheduler process triggers runs automatically.

---

## Features

- **Test Builder** — record tests by clicking through your application
- **Test Editor** — fine-tune recorded tests or author them from scratch in YAML
- **Test Suites** — group related tests; run the whole suite with one click
- **Pipelines** — schedule tests or suites to run automatically on chosen days/times
- **Assertions** — file comparison (exact / image similarity), screenshot region comparison
- **Variables** — `{{placeholder}}` substitution across steps for reusable test data
- **Loops** — repeat a block of steps N times or while a condition holds
- **Retry** — configurable retry-with-delay on flaky steps
- **Results & trends** — per-step screenshots, pass/fail history, duration charts, PDF export
- **Application management** — launch, focus, and close apps as part of a test
- **CLI and web UI** — run tests from either; the web UI is the primary interface

### Supported step types
`click`, `double_click`, `right_click`, `type`, `press_key`, `hotkey`, `scroll`, `wait`, `launch_application`, `verify`, `verify_screenshot`, `compare_saved_file`, `set_variable`, `loop`

### Optional: AI-driven element targeting

wintest can optionally use a vision-language model (ShowUI-2B by default; Qwen2.5-VL also supported) to locate UI elements by description rather than coordinates — e.g., `click "Save button"`. This is useful when a UI layout may shift between runs, but coordinate-based clicks are faster, more deterministic, and recommended for most tests. The AI model is loaded lazily and only when a step actually needs it.

#### Hardware requirements

Only applies if you use AI-driven element targeting. Coordinate-based tests run on any Windows machine.

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **GPU** | NVIDIA GPU with 8 GB VRAM | NVIDIA GPU with 12+ GB VRAM |
| **RAM** | 16 GB | 32 GB |
| **Disk** | ~5 GB free (model weights) | ~10 GB free |
| **CUDA** | CUDA 12.4+ | CUDA 12.4+ |

The model runs in 4-bit quantization (NF4) to fit within consumer GPU memory. An RTX 3060 (12 GB) or equivalent is the baseline tested configuration. CPU-only execution is not supported for AI features.

---

## Setup

### 1. Install wintest

```bash
pip install -e .
```

### 2. (Optional) Install PyTorch with CUDA for AI features

Only needed if you plan to use AI-driven element targeting. Coordinate-based tests don't require it.

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

### 3. Build the web UI frontend

Requires [Node.js](https://nodejs.org/) (LTS recommended).

```bash
cd wintest/ui/web/frontend
npm install
npm run build
```

---

## Usage

### Web UI (primary)

```bash
wintest web
```

Open **http://127.0.0.1:8080** in your browser. On first launch, configure a workspace directory — wintest stores all tests, suites, pipelines, and results inside it.

### CLI

```bash
wintest run path/to/test.yaml              # Execute a test
wintest run-test-suite path/to/suite.yaml  # Execute a suite
wintest validate path/to/test.yaml         # Check a test for errors
wintest init                               # Generate a template test
wintest list-steps                         # Show available step types
wintest scheduler                          # Run the pipeline scheduler
wintest scheduler --install-startup        # Auto-start scheduler at Windows login
wintest scheduler --stop                   # Stop a running scheduler
wintest scheduler --status                 # Check scheduler status
```

### Scheduler

Pipelines only trigger runs when the scheduler process is running. Start it from the Pipelines page in the web UI, or run `wintest scheduler` in a terminal. For unattended machines, use `wintest scheduler --install-startup` to have it launch automatically at each login (the machine must stay logged in — UI automation requires an interactive desktop session).

---

## Test file format

```yaml
name: "Save file and verify output"
variables:
  filename: "test_output.txt"

steps:
  - action: launch_application
    app_path: "C:\\Program Files\\MyApp\\MyApp.exe"
    wait_seconds: 2

  - action: click
    click_x: 0.42
    click_y: 0.18
    description: "Click File menu"

  - action: click
    click_x: 0.45
    click_y: 0.24
    description: "Click Save As"

  - action: type
    text: "{{filename}}"

  - action: hotkey
    keys: ["enter"]

  - action: compare_saved_file
    file_path: "C:\\Users\\me\\Documents"
    baseline_id: expected_output.txt
    compare_mode: exact
```

You rarely write YAML by hand — the Test Builder and Test Editor generate it for you.

---

## Architecture

- **Python / FastAPI** backend with WebSocket support for live run progress
- **React + TypeScript + Vite** frontend served from the same process
- Workspace-based storage: tests, suites, pipelines, baselines, and reports all live under a directory the user chooses
- Scheduler runs as a separate background process using the same test-runner code as the CLI and web UI

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

---

## Known limitations

- Single-monitor testing only (captures the primary display)
- One test can run at a time — UI automation requires exclusive desktop access
- Scheduler runs as a startup program, not a Windows Service, because UI tests need an interactive desktop session
- Windows only
