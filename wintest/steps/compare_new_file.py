"""Compare-new-file step — find a new file in a watched directory and compare to baseline."""

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
    if not step.baseline_id:
        issues.append(f"Step {step_num}: 'compare_new_file' requires a 'baseline_id'")
    return issues


def _find_new_file(dir_path: str, old_snapshot: dict, timeout: float = 30.0) -> str | None:
    """Wait for a new file to appear in the directory."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        current_files = {}
        try:
            for name in os.listdir(dir_path):
                full_path = os.path.join(dir_path, name)
                if os.path.isfile(full_path):
                    current_files[name] = os.path.getmtime(full_path)
        except OSError:
            time.sleep(0.5)
            continue

        # Find files that are new or modified
        new_files = []
        for name, mtime in current_files.items():
            if name not in old_snapshot or mtime > old_snapshot.get(name, 0):
                new_files.append(name)

        if new_files:
            # Return the newest one
            newest = max(new_files, key=lambda n: current_files[n])
            return os.path.join(dir_path, newest)

        time.sleep(0.5)

    return None


def execute(step, runner_ctx):
    """Find the new file and compare against baseline."""
    variables = runner_ctx.get("variables")
    if not variables:
        return StepResult(step=step, passed=False, error="No variable store available")

    dir_path = variables.get("_watch_dir")
    snapshot_json = variables.get("_watch_snapshot")

    if not dir_path or not snapshot_json:
        return StepResult(
            step=step, passed=False,
            error="No watch_directory step found before this step",
        )

    try:
        old_snapshot = json.loads(snapshot_json)
    except json.JSONDecodeError:
        return StepResult(step=step, passed=False, error="Invalid directory snapshot")

    # Wait for new file
    timeout = step.wait_seconds if step.wait_seconds > 0 else 30.0
    new_file = _find_new_file(dir_path, old_snapshot, timeout=timeout)

    if not new_file:
        return StepResult(
            step=step, passed=False,
            error=f"No new file detected in {dir_path} within {timeout:.0f}s",
        )

    logger.info("New file detected: %s", new_file)

    # Store the path in a variable for reference
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

    # Determine comparison mode
    mode = step.compare_mode
    if mode == "exact":
        ext = os.path.splitext(new_file)[1].lower()
        if ext in IMAGE_EXTENSIONS:
            mode = "image"

    if mode == "image":
        return _compare_image(step, new_file, baseline_path)
    else:
        return _compare_exact(step, new_file, baseline_path)


def _compare_exact(step, file_path: str, baseline_path) -> StepResult:
    """Binary comparison."""
    try:
        actual = open(file_path, "rb").read()
        expected = open(baseline_path, "rb").read()
    except Exception as e:
        return StepResult(step=step, passed=False, error=f"Failed to read files: {e}")

    if actual == expected:
        return StepResult(
            step=step, passed=True,
            model_response=f"Files match ({len(actual)} bytes) — {os.path.basename(file_path)}",
        )

    min_len = min(len(actual), len(expected))
    diff_pos = next((i for i in range(min_len) if actual[i] != expected[i]), min_len)
    error = f"Files differ at byte {diff_pos} — {os.path.basename(file_path)}"
    if len(actual) != len(expected):
        error += f" (actual: {len(actual)} bytes, expected: {len(expected)} bytes)"

    return StepResult(step=step, passed=False, error=error)


def _compare_image(step, file_path: str, baseline_path) -> StepResult:
    """Image comparison with similarity threshold."""
    try:
        actual = Image.open(file_path)
        expected = Image.open(str(baseline_path))
    except Exception as e:
        return StepResult(step=step, passed=False, error=f"Failed to open images: {e}")

    result = compare_regions(actual, expected, threshold=step.similarity_threshold)

    if result["similar"]:
        return StepResult(
            step=step, passed=True,
            model_response=f"Image similarity: {result['similarity']:.1%} — {os.path.basename(file_path)}",
        )
    else:
        return StepResult(
            step=step, passed=False,
            error=f"Image differs (similarity: {result['similarity']:.1%}, threshold: {step.similarity_threshold:.1%}) — {os.path.basename(file_path)}",
        )


definition = StepDefinition(
    name="compare_new_file",
    description="Find a new file in a watched directory and compare against a baseline",
    fields=[
        FieldDef("baseline_id", "string", required=True),
        FieldDef("compare_mode", "string"),
        FieldDef("similarity_threshold", "number"),
        FieldDef("wait_seconds", "number"),
    ],
    validate=validate,
    execute=execute,
    is_runner_step=True,
)
