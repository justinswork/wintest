"""Watch-directory step — snapshot directory contents for later comparison."""

import json
import logging
import os

from ._base import StepDefinition, FieldDef
from ..tasks.schema import StepResult

logger = logging.getLogger(__name__)


def validate(step, step_num):
    issues = []
    if not step.file_path:
        issues.append(f"Step {step_num}: 'watch_directory' requires a 'file_path' (directory to watch)")
    return issues


def execute(step, runner_ctx):
    """Snapshot the directory contents and store in variables."""
    dir_path = step.file_path
    if not os.path.isdir(dir_path):
        return StepResult(
            step=step, passed=False,
            error=f"Directory not found: {dir_path}",
        )

    # Snapshot all files with their modification times
    snapshot = {}
    for name in os.listdir(dir_path):
        full_path = os.path.join(dir_path, name)
        if os.path.isfile(full_path):
            snapshot[name] = os.path.getmtime(full_path)

    # Store in variables as JSON
    variables = runner_ctx.get("variables")
    if variables:
        variables.set("_watch_dir", dir_path)
        variables.set("_watch_snapshot", json.dumps(snapshot))

    file_count = len(snapshot)
    logger.info("Directory snapshot: %d files in %s", file_count, dir_path)

    return StepResult(
        step=step, passed=True,
        model_response=f"Watching {dir_path} ({file_count} files)",
    )


definition = StepDefinition(
    name="watch_directory",
    description="Snapshot a directory's contents for detecting new files later",
    fields=[
        FieldDef("file_path", "string", required=True),
    ],
    validate=validate,
    execute=execute,
    is_runner_step=True,
)
