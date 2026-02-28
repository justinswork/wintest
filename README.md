# wintest

AI-powered Windows UI testing tool using [InternVL2-8B](https://huggingface.co/OpenGVLab/InternVL2-8B). Define test tasks in simple YAML files, point them at any desktop application, and let an AI agent execute them autonomously — taking screenshots, finding UI elements, clicking, typing, scrolling, and verifying results.

Think of it as Selenium/Playwright, but for **any desktop application**, powered by visual AI instead of DOM selectors.

---

## How It Works

1. You define a test task in YAML — what app to launch, what steps to perform
2. wintest launches the application and captures a screenshot
3. InternVL2-8B (a vision-language model running locally on your GPU) analyzes the screenshot and locates UI elements
4. The agent executes actions (click, type, scroll, etc.) and verifies expected results
5. A detailed report is generated with annotated screenshots of every step

No pixel matching or template matching — the model uses learned visual understanding.

---

## Features

- **YAML task definitions** — no code required, describe tests in plain language
- **9 action types** — click, double-click, right-click, type, key press, hotkey, scroll, wait, verify
- **Automatic retry** — configurable retry attempts with delay for flaky element detection
- **Application management** — launch, focus, and close applications automatically
- **Error recovery** — dismiss unexpected dialogs, re-focus windows
- **Rich reporting** — HTML and JSON reports with annotated screenshots at every step
- **CLI interface** — `wintest run`, `wintest validate`, `wintest interactive`
- **Web UI** — browser-based dashboard, task editor, live execution viewer, and report browser

---

## Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **GPU** | NVIDIA GPU with 8 GB VRAM | NVIDIA GPU with 12+ GB VRAM |
| **RAM** | 16 GB | 32 GB |
| **Disk** | ~20 GB free (model weights) | ~20 GB free |
| **CUDA** | CUDA 12.4+ | CUDA 12.4+ |

The model runs in 4-bit quantization (NF4) to fit within consumer GPU memory. An RTX 3060 (12 GB) or equivalent is the baseline tested configuration.

**Not supported:** CPU-only execution. A CUDA-capable NVIDIA GPU is required.

---

## Setup

### 1. Install PyTorch with CUDA

PyTorch must be installed separately with CUDA support — it is not available from the default PyPI index.

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

### 2. Install wintest

```bash
pip install -e .
```

### 3. (Optional) Build the web UI frontend

Requires [Node.js](https://nodejs.org/) (LTS recommended).

```bash
cd wintest/ui/web/frontend
npm install
npm run build
```

On first run, the InternVL2-8B model weights (~16 GB) will be downloaded automatically from Hugging Face.

---

## Usage

### CLI

```bash
# Run a test task
wintest run examples/notepad_test.yaml

# Validate a task file for errors
wintest validate examples/notepad_test.yaml

# Generate a template task file
wintest init

# List available action types
wintest list-actions

# Interactive mode — type natural language commands
wintest interactive
```

### Web UI

```bash
wintest web
```

Open **http://127.0.0.1:8080** in your browser. From the web UI you can:

- **Dashboard** — see all tasks, model status, and recent reports
- **Task Editor** — create and edit tasks with drag-and-drop step reordering
- **Execution Viewer** — watch live step progress and screenshots as tasks run
- **Report Browser** — view past reports with step-by-step details and screenshots

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

## Known Limitations

- Coordinate precision varies depending on the element and screen layout
- Single-monitor only (captures the primary display)
- The model was not specifically trained on custom application UIs — accuracy on non-standard elements may be lower
- First run requires a large model download (~16 GB)
- One task execution at a time (GPU is single-threaded)
