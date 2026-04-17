from dataclasses import dataclass, field


VALID_DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


@dataclass
class PipelineDefinition:
    name: str
    enabled: bool = True
    target_type: str = "test"  # "test" or "suite"
    target_file: str = ""
    schedule_days: list[str] = field(default_factory=list)
    schedule_time: str = "00:00"  # HH:MM, 24-hour
