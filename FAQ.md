# FAQ & Known Limitations

Honest answers to the questions a developer would ask before adopting wintest.

---

## General

### What is wintest?

An AI-powered desktop UI testing tool for Windows. You write tests in YAML that describe what to click, type, and verify using natural language (e.g. `target: "the Save button"`). An 8B vision-language model looks at screenshots of your desktop and finds the elements. No element selectors, no accessibility tree, no pixel coordinates — the AI sees the screen the way a human does.

### Why would I use this instead of existing tools?

Most desktop UI testing tools (WinAppDriver, Appium, FlaUI, pywinauto) rely on the UI Automation accessibility tree. That works well for standard Windows controls but falls apart with:
- Custom-rendered UI (game engines, Electron apps with custom components, CAD software)
- Applications where the accessibility tree is incomplete or broken
- Cross-toolkit testing (testing an app that uses Win32, WPF, and web views)

wintest doesn't care about the underlying framework. If a human can see it on screen, the model can (in theory) find it.

### Where does wintest shine?

**Testing apps that other tools can't handle.** If your application uses custom-rendered controls, a game engine UI, or a mix of UI frameworks (Win32 dialogs inside a WPF shell inside an Electron wrapper), traditional automation tools give up because there's nothing in the accessibility tree to grab. wintest doesn't care — it looks at pixels, not control trees.

**Testing without modifying the application.** You don't need to add automation IDs, expose an accessibility API, or instrument the app in any way. wintest works against the shipping binary, exactly as the end user would see it. This makes it ideal for testing third-party software you don't control, legacy apps with no source code, or release builds where debug instrumentation is stripped.

**Resilience to UI changes.** A traditional UI test that clicks `AutomationId="btnSave"` breaks the moment someone renames that ID. A Sikuli test that matches a screenshot of the Save icon breaks when the icon set changes. A wintest step that targets `"the Save button"` keeps working as long as there's something on screen that looks like a Save button — it can survive icon redesigns, layout shuffles, theme changes, and resolution changes without updating the test.

**Readable, self-documenting tests.** The YAML format reads like a user story:
```yaml
- action: click
  target: "the File menu"
- action: click
  target: "Save As"
- action: type
  text: "my_document.txt"
- action: press_key
  key: "enter"
```
A QA engineer, a product manager, or a new team member can read this and understand exactly what the test does. No XPath expressions, no CSS selectors, no automation ID lookups. The test describes intent, not implementation.

**Visual evidence of every step.** Every step produces an annotated screenshot showing exactly what the AI saw and where it clicked. When a test fails, you don't have to guess — you can open the HTML report and see the screenshot at the moment of failure. This is significantly more useful for debugging than a stack trace or a log line that says "element not found."

**No-code test authoring.** Tests are plain YAML files. You don't need to know Python, C#, or any programming language to write, edit, or understand them. The web UI provides a form-based editor with drag-and-drop step reordering, making it accessible to manual QA teams who want to automate without learning to code.

**Testing what the user actually sees.** Accessibility-tree-based tools can report that a button exists and is enabled even when it's completely hidden behind another window, rendered off-screen, or visually obscured by an overlay. wintest's vision approach only finds elements that are actually visible on screen — if the user can't see it, the model can't either. This catches a class of bugs that other tools miss.

**Built-in recovery from real-world desktop messiness.** Desktop apps are messy — unexpected dialogs pop up, UAC prompts steal focus, Windows Update notifications appear mid-test. The recovery strategy automatically dismisses unexpected windows and re-focuses the app under test. This mirrors what a human tester would do instinctively.

**Negative assertions.** The `verify` step with `expected: false` lets you assert that something is NOT visible on screen. This is surprisingly hard with selector-based tools (how do you prove an element doesn't exist in the accessibility tree if the tree is incomplete?) but natural with vision — if the model can't find it, it's not there.

### When should I NOT use this tool?

- **When accessibility-tree-based tools work fine.** If your app has a clean automation tree, tools like FlaUI or WinAppDriver are faster, more deterministic, and don't need a GPU. Use them.
- **When you need sub-second test execution.** Each vision step takes several seconds (screenshot + model inference). A 20-step test might take 2-3 minutes.
- **When you need pixel-perfect precision.** The AI returns approximate coordinates. It's usually close enough for buttons and text fields, but don't expect it to reliably hit a 5px drag handle.
- **When you need to run tests in CI/CD.** This tool requires a visible desktop and a CUDA GPU. It can't run headless, in a container, or on a standard CI runner (see "CI/CD" section below).
- **When you need 100% deterministic tests.** Vision-based element finding is inherently probabilistic. The same test can pass 9 times and fail on the 10th because the model misinterprets a screenshot.

---

## Reliability & Accuracy

### How accurate is the vision model?

It varies. For clearly labeled, visually distinct UI elements (buttons with text, menu items, prominent icons), accuracy is generally good. It degrades with:
- **Small or ambiguous targets** — a 16x16 icon with no label is harder to find than a button that says "Save"
- **Visually similar elements** — "OK" and "Cancel" buttons side by side can be confused
- **Dense UIs** — toolbars with 30 small icons are challenging
- **Non-English text** — the model was trained primarily on English UI screenshots
- **High-DPI or unusual scaling** — the image is resized to 448x448 before inference, so fine details can be lost

There is no published accuracy benchmark specific to wintest's use case.

### Aren't vision-based tests inherently flaky?

Yes, more so than selector-based tests. Mitigations in place:
- **Retries** — each step retries up to 3 times (configurable) with a delay between attempts
- **Recovery** — if the app loses focus or a dialog pops up, the recovery strategy dismisses it and re-focuses
- **Rich descriptions** — the more specific your target description, the better (e.g. `"the blue Save button in the top toolbar"` beats `"Save"`)

But retries are not a substitute for reliability. A step that fails 30% of the time will still cause flaky test runs even with retries. This is a fundamental limitation of the approach.

### What happens if the model returns garbage coordinates?

The coordinate parser validates that values are in the 0–1000 range. If the model returns unparseable text (no coordinates found), the step is retried. If all retries fail, the step fails. The raw model response is saved in the report for debugging.

The model cannot return coordinates that are "valid but wrong" in a detectable way — if it confidently returns `[300, 400]` but that's the wrong element, wintest clicks it. The `verify` step type exists specifically so you can assert the result of a previous action.

### Can the model handle dark mode, high contrast, or themed UIs?

Somewhat. The model has seen diverse training data, but it works best on standard-looking Windows UIs. Heavily themed or high-contrast interfaces may reduce accuracy. There's no special handling for themes — the model just sees pixels.

---

## Security

### Can a malicious YAML test file do damage?

**Yes.** This is the most significant security concern. The `launch_application` step passes `app_path` directly to `subprocess.Popen(path, shell=True)`. There is no path validation, allow-listing, or sandboxing. A crafted YAML file could:

```yaml
steps:
  - action: launch_application
    app_path: "cmd.exe /c rd /s /q C:\\"
```

Additionally, the `type` step will type any text into whatever has focus, and `hotkey` can trigger arbitrary key combinations.

**Mitigation:** Only run test YAML files you trust, the same way you'd only run scripts you trust. wintest is a power tool — it has full control of your desktop.

### Is the web UI authenticated?

No. There is no authentication or authorization. The API accepts requests from anyone who can reach the server. CORS is configured to allow all origins. **Do not expose the web UI to untrusted networks.** It is designed for local use (`localhost`).

### Does `yaml.safe_load` protect against YAML deserialization attacks?

Yes. wintest uses `yaml.safe_load` (not `yaml.load`), which prevents arbitrary Python object instantiation. The YAML parsing itself is safe. The risk is in what wintest *does* with the parsed values (see above).

---

## Performance & Requirements

### What GPU do I need?

InternVL2-8B with 4-bit quantization needs approximately **6-8 GB of VRAM**. In practice:
- **RTX 3060 (12 GB):** works well
- **RTX 3060 (8 GB) or RTX 4060 (8 GB):** works, tight on VRAM
- **GTX 1660 or lower:** likely won't work (no BitsAndBytes support or insufficient VRAM)
- **No GPU:** won't work at all — CUDA is required, there is no CPU fallback

The model loads in ~30-60 seconds on first run. Subsequent runs reuse the cached model (in web mode).

### What happens if I run out of VRAM mid-test?

The test crashes with a CUDA out-of-memory error. There is no graceful handling — the error propagates up, the run is marked as failed, and you may need to restart the server to recover the GPU state. In web mode, the model stays loaded between runs, so VRAM usage is stable after the first load.

### How large is the dependency footprint?

Large. The core dependencies include:
- **PyTorch** (~2-3 GB download)
- **transformers + tokenizers** (~500 MB)
- **bitsandbytes** (CUDA quantization library, can be finicky on Windows)
- **pyautogui** (screen/input control)
- **FastAPI + uvicorn** (web server)
- **Node.js + npm** (for building the frontend)

A fresh install downloads several GB of Python packages plus the model weights (~8 GB on first run via HuggingFace Hub). This is not a lightweight tool.

### Does bitsandbytes work on Windows?

It can, but it's historically been fragile. The official `bitsandbytes` package has had inconsistent Windows support. You may need `bitsandbytes-windows` or a specific version. If quantization fails to load, the model won't start.

---

## Architecture

### Can I run tests without the web UI?

Yes. The CLI (`wintest run test.yaml`) works independently. You don't need to start the web server.

### Can two users run tests at the same time?

No. There is a single-worker `ThreadPoolExecutor` and a single `current_run` slot. If a run is already in progress, the API returns an error. There is no run queue — you can't submit a test to run "next."

Beyond the software limitation, the tool controls the physical mouse and keyboard. Two concurrent tests would fight over input and produce garbage results.

### Why file-based storage instead of a database?

Simplicity. Tests are YAML files on disk, reports are directories with JSON + HTML + screenshots. No database to install, configure, back up, or migrate. You can version-control your tests with git, copy reports to a shared drive, or delete them with `rm -rf`.

The tradeoff: listing tests requires scanning a directory, listing reports requires reading every `report.json`, and there's no indexing or querying. This is fine for dozens or hundreds of tests/reports but would get slow at thousands.

### Why is the frontend a separate build step?

The React SPA is built with Vite into `frontend/dist/` and served as static files by FastAPI. The built files are not checked into the repository, so you need Node.js installed to build the frontend before first use. This is a one-time step (`npm install && npm run build` in the frontend directory).

This is a common pattern for Python + SPA projects, but it does mean the initial setup has two ecosystems (Python + Node.js) to install.

### What about the `trust_remote_code=True` in model loading?

The model is loaded with `trust_remote_code=True` because InternVL2 requires custom model code from the HuggingFace Hub. This means you're executing Python code downloaded from the internet. This is standard practice for HuggingFace models but worth understanding — you're trusting OpenGVLab's model repository.

---

## Desktop Interaction

### Can I use my computer while a test is running?

**No.** wintest takes control of the mouse and keyboard via PyAutoGUI. If you move the mouse during a test, you'll interfere with the click coordinates. If you type, your keystrokes will be mixed into the test's input. If you switch windows, the test will lose focus on the target app.

PyAutoGUI's failsafe is enabled — moving the mouse to any corner of the screen will abort the test immediately (raises `pyautogui.FailSafeException`). This is a safety valve, not a clean stop mechanism.

This is a fundamental limitation of desktop automation. The test needs exclusive access to the input devices. See TODO item 24 (Environment Isolation) for future mitigation ideas.

### What if a test launches the wrong application or clicks the wrong thing?

The test runs with your user's full permissions. It can click anything on screen, type anything, and launch any application. There are no guardrails beyond the PyAutoGUI failsafe corner and the step timeout.

A test that goes wrong can cause real damage — typing text into the wrong window, clicking "Delete" instead of "Save," or launching a destructive command. **Always review your test YAML before running it**, especially the first time.

### Does wintest handle multi-monitor setups?

Not explicitly. PyAutoGUI's `screenshot()` captures the primary monitor by default. The 0–1000 coordinate scale maps to the primary monitor's resolution. Multi-monitor setups may produce unexpected behavior if the target application is on a secondary display.

---

## CI/CD & Automation

### Can I run wintest in a CI/CD pipeline?

Not in a typical CI environment. Requirements:
1. **A visible Windows desktop** — the tool takes screenshots of the actual display. No headless mode.
2. **A CUDA GPU** — the vision model requires GPU inference. No CPU fallback.
3. **Physical or virtual display** — RDP sessions, virtual machines with GPU passthrough, or physical machines can work. Standard GitHub Actions / Azure DevOps hosted agents will not.

For CI/CD, you'd need a dedicated Windows machine with a GPU and an active desktop session (not just a locked RDP session — the screen must be visible).

### Can this run in a Docker container?

No. It needs a Windows desktop with GPU access. Docker on Windows doesn't support GPU passthrough in the way needed, and there's no display to screenshot.

---

## Comparison with Other Tools

### wintest vs. WinAppDriver / Appium

| | wintest | WinAppDriver / Appium |
|---|---|---|
| Element finding | AI vision (natural language) | UI Automation accessibility tree |
| Speed | Seconds per step | Milliseconds per step |
| Determinism | Probabilistic | Deterministic |
| Custom/non-standard UI | Works regardless of framework | Requires automation IDs or accessibility support |
| App instrumentation needed | None — test the shipping binary | Often needs IDs added to source code |
| Test readability | Plain English YAML | Code (C#, Java, Python) with selector strings |
| Debugging failed tests | Screenshot of every step | Stack trace + log messages |
| Resilience to UI redesigns | High — descriptions survive layout changes | Low — selectors break on ID/structure changes |
| GPU required | Yes (CUDA) | No |
| Setup complexity | High (GPU, model, Node.js) | Medium |
| CI/CD friendly | Requires dedicated GPU machine | Standard CI agents work |
| Mature ecosystem | New project | Well-established, large community |

**Use wintest when:** your app has custom-rendered controls, no automation IDs, or you're testing a third-party binary you can't modify. Also when you want non-technical team members to be able to read and write tests.

**Use WinAppDriver/Appium when:** your app has good accessibility support, you need fast deterministic tests, or you need to run in CI/CD on standard infrastructure.

### wintest vs. Selenium / Playwright

These are web testing tools. wintest tests desktop applications. They solve different problems. If you're testing a web app, use Selenium or Playwright — they're faster, more reliable, and purpose-built for that job.

That said, wintest can test Electron apps and other desktop apps that happen to use web technology under the hood but don't expose a browser automation protocol. If your "web app" is packaged as a desktop application and you can't use DevTools protocol, wintest can still test it visually.

### wintest vs. Sikuli / OpenCV template matching

| | wintest | Sikuli / template matching |
|---|---|---|
| Element finding | Natural language description | Reference screenshot |
| Handles theme/resolution changes | Yes — describes intent, not appearance | No — pixel-level match required |
| Test maintenance | Low — descriptions rarely need updating | High — re-capture screenshots after any UI change |
| Asset management | None — descriptions are inline text | Must store and version reference images |
| Speed | Slower (LLM inference) | Faster (image comparison) |
| Accuracy on exact targets | Lower (probabilistic) | Higher (deterministic pixel match) |
| Can find unseen elements | Yes — generalizes from description | No — must have captured the exact appearance |

**Use wintest when:** the UI changes frequently, you test across themes/resolutions, or you don't want to maintain a library of reference screenshots.

**Use Sikuli when:** you need faster execution, the UI rarely changes visually, or you need to match elements that are hard to describe in words (complex icons, graphical elements).

---

## Known Issues & Shortcomings

### Tests cannot run in the background
The tool requires exclusive desktop access. You cannot use your computer for anything else while tests are running. This is the single biggest usability limitation.

### No test parallelism
Only one test can run at a time. Even for test suites, tests run sequentially because they share the same screen and input devices.

### No headless mode
The tool cannot run without a visible display. This limits its usefulness for automated/scheduled testing unless you dedicate a machine to it.

### Vision accuracy is unpredictable
There's no way to know in advance whether the model will correctly identify a UI element. You find out by running the test. A target description that works today might fail tomorrow if the model produces different logits.

### Recovery is best-effort
The recovery strategy (dismiss dialog, re-focus app) handles common cases but can't recover from all failures. If the app crashes, displays an unexpected wizard, or enters an unrecognizable state, recovery won't help.

### No undo for test actions
If a test clicks "Delete" or "Format Drive," there's no way to undo it. Tests operate with the full permissions of the logged-in user.

### Model compatibility is fragile
The vision model loading includes manual patches for HuggingFace `transformers` version compatibility. When `transformers` updates, these patches may break. The model also requires `trust_remote_code=True`, which downloads and executes Python code from the HuggingFace Hub.

### bitsandbytes on Windows
The 4-bit quantization library (`bitsandbytes`) has historically had inconsistent Windows support. Installation issues are a common stumbling block.

### No authentication on the web UI
The web server has no login, no API keys, and allows all CORS origins. It should only be run on `localhost` or a trusted network.

### Step timeout uses daemon threads
Per-step timeouts work by running the step in a daemon thread and abandoning it if it exceeds the deadline. The abandoned thread continues running in the background until it completes — it's not actually killed. This can cause resource issues if many steps time out in succession.

### Report storage is unbounded
Reports accumulate in the `reports/` directory with no automatic cleanup. Over time, this can consume significant disk space, especially with screenshots. Manual deletion or the web UI's delete button are the only cleanup mechanisms.

### No pagination on API endpoints
The test list, report list, and step results are returned in full — no pagination. This works for small numbers but would degrade with hundreds of items.
