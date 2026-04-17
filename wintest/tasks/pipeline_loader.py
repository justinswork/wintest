"""Loader for pipeline YAML files."""

import re

import yaml

from .pipeline_schema import PipelineDefinition, VALID_DAYS

_TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def load_pipeline(filepath: str) -> PipelineDefinition:
    """Load a pipeline definition from a YAML file."""
    with open(filepath, "r") as f:
        data = yaml.safe_load(f) or {}

    if "name" not in data:
        raise ValueError(f"Pipeline file {filepath} missing required 'name' field")

    target_type = data.get("target_type", "test")
    if target_type not in ("test", "suite"):
        raise ValueError(
            f"Pipeline file {filepath}: target_type must be 'test' or 'suite'"
        )

    target_file = data.get("target_file", "")
    if not target_file:
        raise ValueError(f"Pipeline file {filepath} missing required 'target_file' field")

    schedule = data.get("schedule", {})
    days = [d.lower() for d in schedule.get("days", [])]
    invalid = [d for d in days if d not in VALID_DAYS]
    if invalid:
        raise ValueError(f"Pipeline file {filepath}: invalid day(s) {invalid}")

    time_str = schedule.get("time", "00:00")
    if not _TIME_PATTERN.match(time_str):
        raise ValueError(
            f"Pipeline file {filepath}: schedule.time must be 'HH:MM' (24-hour), got '{time_str}'"
        )

    return PipelineDefinition(
        name=data["name"],
        enabled=bool(data.get("enabled", True)),
        target_type=target_type,
        target_file=target_file,
        schedule_days=days,
        schedule_time=time_str,
    )
