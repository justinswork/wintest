# wintest

AI-powered Windows UI testing tool using [InternVL2-8B](https://huggingface.co/OpenGVLab/InternVL2-8B). Takes a live screenshot, sends it to a vision-language model running locally on your GPU, and returns the coordinates of a requested UI element.

> **Status:** Early development — core detection pipeline is functional.

---

## How It Works

1. Captures a screenshot of your desktop via `pyautogui`
2. Preprocesses the image and feeds it to InternVL2-8B (a vision-language model)
3. The model interprets the screenshot and returns the coordinates of the requested UI element
4. No pixel matching or template matching — the model uses learned visual understanding

---

## Vision

The goal is to build a complete **AI-powered Windows UI testing tool**. The end state:

- **Define test tasks** in simple YAML files — no code required
- **Point it at any desktop application** — the tool launches the app and runs your tests
- **AI agent executes autonomously** — takes screenshots, finds UI elements, clicks, types, scrolls, and verifies results
- **Get a pass/fail report** — with annotated screenshots showing exactly what the agent saw and did at each step
- **Easy-to-use interface** — CLI for developers, web UI for everyone else

Think of it as Selenium/Playwright, but for **any desktop application**, powered by visual AI instead of DOM selectors.

See [ROADMAP.md](ROADMAP.md) for the detailed implementation plan.

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

### 2. Install remaining dependencies

```bash
pip install -r requirements.txt
```

### 3. Run

```bash
python run.py
```

On first run, the InternVL2-8B model weights (~16 GB) will be downloaded automatically from Hugging Face.

---

## Usage

Edit the `target` variable in `run.py` to search for any visible UI element:

```python
target = "Windows Start button"
```

The script will output the model's response with approximate coordinates:

```
TARGET: Windows Start button
AI RESPONSE: The 'Windows Start button' is located in the bottom left corner...
```

---

## Project Structure

```
wintest/
  run.py              # Main script — model loading, screenshot, inference
  requirements.txt    # Python dependencies
  README.md
```

---

## Roadmap

| Phase | Name | Description | Status |
|-------|------|-------------|--------|
| 1 | Core Engine | Refactor into package, reliable coordinate parsing, click/type actions | Not started |
| 2 | Agent Loop | Screenshot-analyze-act-verify loop, YAML task definitions | Not started |
| 3 | Reporting | HTML/JSON reports with annotated screenshots, timing data | Not started |
| 4 | App Management | Application lifecycle, error recovery, configuration | Not started |
| 5 | CLI | `wintest run task.yaml`, `wintest interactive`, validation | Not started |
| 6 | Web UI | Visual task editor, live execution viewer, test suites | Not started |

See [ROADMAP.md](ROADMAP.md) for full details on each phase.

---

## Known Limitations

- Coordinate precision varies depending on the element and screen layout
- Single-monitor only (captures the primary display)
- The model was not specifically trained on custom application UIs — accuracy on non-standard elements may be lower
- First run requires a large model download (~16 GB)
