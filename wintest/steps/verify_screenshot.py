"""Verify-screenshot step — compare a screen region against a saved baseline."""

import logging
import os

from PIL import Image

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult
from ..config import workspace
from ..core.screenshot_compare import compare_regions, crop_region

logger = logging.getLogger(__name__)


def validate(step, step_num):
    issues = []
    if not step.baseline_id:
        issues.append(f"Step {step_num}: 'verify_screenshot' requires a 'baseline_id'")
    if not step.region:
        issues.append(f"Step {step_num}: 'verify_screenshot' requires a 'region' [x1, y1, x2, y2]")
    elif len(step.region) != 4:
        issues.append(f"Step {step_num}: 'region' must have exactly 4 values [x1, y1, x2, y2]")
    return issues


def execute(step, runner_ctx):
    """Execute in runner context to access screen capture."""
    agent = runner_ctx.get("agent")
    if agent is None:
        return StepResult(step=step, passed=False, error="No agent available")

    # Capture current screen
    screenshot = agent.screen.capture()

    # Crop the region of interest
    try:
        actual_crop = crop_region(screenshot, step.region)
    except Exception as e:
        return StepResult(step=step, passed=False, error=f"Failed to crop region: {e}")

    # Load baseline
    baseline_path = workspace.baselines_dir() / f"{step.baseline_id}.png"
    if not baseline_path.exists():
        return StepResult(
            step=step, passed=False,
            error=f"Baseline not found: {step.baseline_id}",
        )

    try:
        baseline = Image.open(baseline_path)
    except Exception as e:
        return StepResult(step=step, passed=False, error=f"Failed to load baseline: {e}")

    # Compare
    result = compare_regions(actual_crop, baseline, threshold=step.similarity_threshold)

    # Always save screenshots to report dir when available
    screenshot_path = None
    actual_path = None
    baseline_copy_path = None
    if agent.report_dir:
        screenshots_dir = os.path.join(agent.report_dir, "screenshots")
        os.makedirs(screenshots_dir, exist_ok=True)

        actual_path = os.path.join(screenshots_dir, f"actual_{step.baseline_id}.png")
        actual_crop.save(actual_path)

        baseline_copy_path = os.path.join(screenshots_dir, f"baseline_{step.baseline_id}.png")
        baseline.save(baseline_copy_path)

        diff_path = os.path.join(screenshots_dir, f"diff_{step.baseline_id}.png")
        result["diff_image"].save(diff_path)
        screenshot_path = diff_path

    if result["similar"]:
        return StepResult(
            step=step, passed=True,
            model_response=f"Similarity: {result['similarity']:.1%}",
            screenshot_path=screenshot_path,
            actual_screenshot_path=actual_path,
            baseline_screenshot_path=baseline_copy_path,
        )
    else:
        return StepResult(
            step=step, passed=False,
            error=f"Screenshot differs from baseline (similarity: {result['similarity']:.1%}, threshold: {step.similarity_threshold:.1%})",
            screenshot_path=screenshot_path,
            actual_screenshot_path=actual_path,
            baseline_screenshot_path=baseline_copy_path,
        )


definition = StepDefinition(
    name="verify_screenshot",
    description="Compare a screen region against a saved baseline image",
    fields=[
        FieldDef("baseline_id", "string", required=True),
        FieldDef("region", "number[]", required=True),
        FieldDef("similarity_threshold", "number"),
    ],
    validate=validate,
    execute=execute,
    is_runner_step=True,
)
