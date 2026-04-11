"""Compare-file step — compare a file against a saved baseline."""

import logging
import os

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
        issues.append(f"Step {step_num}: 'compare_file' requires a 'file_path'")
    if not step.baseline_id:
        issues.append(f"Step {step_num}: 'compare_file' requires a 'baseline_id'")
    if step.compare_mode not in ("exact", "image"):
        issues.append(f"Step {step_num}: 'compare_mode' must be 'exact' or 'image'")
    return issues


def _detect_mode(file_path: str, explicit_mode: str) -> str:
    """Auto-detect comparison mode from file extension if not explicitly set."""
    if explicit_mode != "exact":
        return explicit_mode
    ext = os.path.splitext(file_path)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    return "exact"


def execute(step, runner_ctx):
    """Execute in runner context."""
    file_path = step.file_path
    if not os.path.exists(file_path):
        return StepResult(
            step=step, passed=False,
            error=f"File not found: {file_path}",
        )

    baseline_path = workspace.baselines_dir() / f"{step.baseline_id}"
    # Try with and without extension
    if not baseline_path.exists():
        # Look for any file with this baseline_id prefix
        candidates = list(workspace.baselines_dir().glob(f"{step.baseline_id}.*"))
        if candidates:
            baseline_path = candidates[0]
        else:
            return StepResult(
                step=step, passed=False,
                error=f"Baseline not found: {step.baseline_id}",
            )

    mode = _detect_mode(file_path, step.compare_mode)

    if mode == "image":
        return _compare_image(step, file_path, baseline_path)
    else:
        return _compare_exact(step, file_path, baseline_path)


def _compare_exact(step, file_path: str, baseline_path) -> StepResult:
    """Binary comparison — files must be identical."""
    try:
        actual = open(file_path, "rb").read()
        expected = open(baseline_path, "rb").read()
    except Exception as e:
        return StepResult(step=step, passed=False, error=f"Failed to read files: {e}")

    if actual == expected:
        return StepResult(
            step=step, passed=True,
            model_response=f"Files match ({len(actual)} bytes)",
        )

    # Find where they differ
    min_len = min(len(actual), len(expected))
    diff_pos = next((i for i in range(min_len) if actual[i] != expected[i]), min_len)

    error = f"Files differ at byte {diff_pos}"
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
            model_response=f"Image similarity: {result['similarity']:.1%}",
        )
    else:
        return StepResult(
            step=step, passed=False,
            error=f"Image differs from baseline (similarity: {result['similarity']:.1%}, threshold: {step.similarity_threshold:.1%})",
        )


definition = StepDefinition(
    name="compare_file",
    description="Compare a file against a saved baseline (exact match or image similarity)",
    fields=[
        FieldDef("file_path", "string", required=True),
        FieldDef("baseline_id", "string", required=True),
        FieldDef("compare_mode", "string"),
        FieldDef("similarity_threshold", "number"),
    ],
    validate=validate,
    execute=execute,
    is_runner_step=True,
)
