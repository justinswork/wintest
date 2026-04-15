"""Compare-saved-file step — watch a directory for a new file and compare to baseline.

Combines watch_directory + compare_new_file into a single step. The runner
takes a directory snapshot before executing this step's predecessors, then
at execution time finds the new file and compares it.
"""

import json
import logging
import os
import time

from PIL import Image

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult
from ..config import workspace
from ..core.screenshot_compare import compare_regions

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".gif"}


def validate(step, step_num):
    issues = []
    if not step.file_path:
        issues.append(f"Step {step_num}: 'compare_saved_file' requires a 'file_path' (directory to watch)")
    if not step.baseline_id:
        issues.append(f"Step {step_num}: 'compare_saved_file' requires a 'baseline_id'")
    return issues


def execute(step, runner_ctx):
    """Find the new file in the watched directory and compare against baseline."""
    dir_path = step.file_path

    if not os.path.isdir(dir_path):
        return StepResult(step=step, passed=False, error=f"Directory not found: {dir_path}")

    # Get the snapshot from the runner context (set by the runner before this step)
    variables = runner_ctx.get("variables")
    snapshot_json = variables.get(f"_dir_snapshot_{dir_path}") if variables else None

    if not snapshot_json:
        return StepResult(
            step=step, passed=False,
            error=f"No directory snapshot for {dir_path}. This step needs preceding steps to trigger a file save.",
        )

    try:
        old_snapshot = json.loads(snapshot_json)
    except json.JSONDecodeError:
        return StepResult(step=step, passed=False, error="Invalid directory snapshot")

    # Wait for new file
    timeout = step.wait_seconds if step.wait_seconds > 0 else 30.0
    logger.info("Watching %s for a new file (timeout: %.0fs)...", dir_path, timeout)

    # Broadcast watching status if running from web
    progress_cb = runner_ctx.get("progress_callback")
    if progress_cb and hasattr(progress_cb, 'app_state'):
        progress_cb.app_state.broadcast_sync({
            "type": "watching_directory",
            "directory": dir_path,
            "timeout": timeout,
        })
    new_file = _find_new_file(dir_path, old_snapshot, timeout=timeout)

    # Clear watching status
    if progress_cb and hasattr(progress_cb, 'app_state'):
        progress_cb.app_state.broadcast_sync({"type": "watching_directory_done"})

    if not new_file:
        return StepResult(
            step=step, passed=False,
            error=f"No new file detected in {dir_path} within {timeout:.0f}s",
        )

    logger.info("New file detected: %s", new_file)

    if variables:
        variables.set("new_file_path", new_file)

    # Load baseline
    baseline_path = workspace.baselines_dir() / f"{step.baseline_id}"
    if not baseline_path.exists():
        candidates = list(workspace.baselines_dir().glob(f"{step.baseline_id}*"))
        if candidates:
            baseline_path = candidates[0]
        else:
            return StepResult(
                step=step, passed=False,
                error=f"Baseline not found: {step.baseline_id}",
            )

    mode = step.compare_mode
    if mode == "exact":
        ext = os.path.splitext(new_file)[1].lower()
        if ext in IMAGE_EXTENSIONS:
            mode = "image"

    if mode == "image":
        return _compare_image(step, new_file, baseline_path)
    else:
        return _compare_exact(step, new_file, baseline_path)


def _find_new_file(dir_path, old_snapshot, timeout=30.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            current = {}
            for name in os.listdir(dir_path):
                full = os.path.join(dir_path, name)
                if os.path.isfile(full):
                    current[name] = os.path.getmtime(full)

            new_files = [
                name for name in current
                if name not in old_snapshot
            ]
            if new_files:
                newest = max(new_files, key=lambda n: current[n])
                return os.path.join(dir_path, newest)
        except OSError:
            pass
        time.sleep(0.5)
    return None


def _compare_exact(step, file_path, baseline_path):
    try:
        actual = open(file_path, "rb").read()
        expected = open(baseline_path, "rb").read()
    except Exception as e:
        return StepResult(step=step, passed=False, error=f"Failed to read files: {e}")

    info = f"Actual: {file_path}\nBaseline: {baseline_path}"
    if actual == expected:
        return StepResult(
            step=step, passed=True,
            model_response=f"Files match ({len(actual)} bytes)\n{info}",
        )

    min_len = min(len(actual), len(expected))
    diff_pos = next((i for i in range(min_len) if actual[i] != expected[i]), min_len)
    error = f"Files differ at byte {diff_pos}"
    if len(actual) != len(expected):
        error += f" (actual: {len(actual)} bytes, expected: {len(expected)} bytes)"
    error += f"\n{info}"
    return StepResult(step=step, passed=False, error=error)


def _compare_image(step, file_path, baseline_path):
    try:
        actual = Image.open(file_path)
        expected = Image.open(str(baseline_path))
    except Exception as e:
        return StepResult(step=step, passed=False, error=f"Failed to open images: {e}")

    result = compare_regions(actual, expected, threshold=step.similarity_threshold)
    info = f"Actual: {file_path}\nBaseline: {baseline_path}"
    if result["similar"]:
        return StepResult(
            step=step, passed=True,
            model_response=f"Image similarity: {result['similarity']:.1%}\n{info}",
        )
    return StepResult(
        step=step, passed=False,
        error=f"Image differs (similarity: {result['similarity']:.1%})\n{info}",
    )


definition = StepDefinition(
    name="compare_saved_file",
    description="Watch a directory for a new file and compare against a baseline",
    fields=[
        FieldDef("file_path", "string", required=True),
        FieldDef("baseline_id", "string", required=True),
        FieldDef("compare_mode", "string"),
        FieldDef("similarity_threshold", "number"),
        FieldDef("wait_seconds", "number"),
    ],
    validate=validate,
    execute=execute,
    is_runner_step=True,
)
