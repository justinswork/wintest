from __future__ import annotations

import copy
import os
from dataclasses import dataclass, field
from typing import Optional

import yaml


@dataclass
class ModelSettings:
    model_path: str = "OpenGVLab/InternVL2-8B"
    load_in_4bit: bool = True
    bnb_4bit_compute_dtype: str = "float16"
    bnb_4bit_quant_type: str = "nf4"
    bnb_4bit_use_double_quant: bool = True
    max_new_tokens: int = 200
    input_size: int = 448


@dataclass
class ActionSettings:
    action_delay: float = 0.5
    failsafe: bool = True
    type_interval: float = 0.05
    coordinate_scale: int = 1000


@dataclass
class RetrySettings:
    retry_attempts: int = 3
    retry_delay: float = 2.0


@dataclass
class TimeoutSettings:
    step_timeout: float = 60.0
    test_timeout: float = 600.0


@dataclass
class RecoverySettings:
    enabled: bool = True
    max_recovery_attempts: int = 2
    dismiss_dialog_keys: list[str] = field(default_factory=lambda: ["escape"])
    recovery_delay: float = 1.0


@dataclass
class LoggingSettings:
    level: str = "INFO"
    log_file: Optional[str] = None


@dataclass
class AppSettings:
    wait_after_launch: float = 3.0
    focus_delay: float = 0.3
    graceful_close_timeout: float = 5.0


@dataclass
class Settings:
    """
    Top-level settings container.

    Resolution order:
      1. Hardcoded defaults (this dataclass)
      2. config.yaml (merged on top)
      3. Test YAML settings: block (merged on top)
      4. Per-action overrides (handled at runtime)
    """

    model: ModelSettings = field(default_factory=ModelSettings)
    action: ActionSettings = field(default_factory=ActionSettings)
    retry: RetrySettings = field(default_factory=RetrySettings)
    timeout: TimeoutSettings = field(default_factory=TimeoutSettings)
    recovery: RecoverySettings = field(default_factory=RecoverySettings)
    logging: LoggingSettings = field(default_factory=LoggingSettings)
    app: AppSettings = field(default_factory=AppSettings)

    @classmethod
    def load(cls, config_path: str = "config.yaml") -> Settings:
        """Load settings from a YAML file, merging on top of defaults."""
        settings = cls()
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                data = yaml.safe_load(f) or {}
            settings._merge(data)
        return settings

    def merge_test_settings(self, test_settings: dict) -> Settings:
        """Return a new Settings with test-level overrides applied."""
        merged = copy.deepcopy(self)
        merged._merge(test_settings)
        return merged

    def _merge(self, data: dict) -> None:
        """Merge a dict of settings onto this instance."""
        section_map = {
            "model": self.model,
            "action": self.action,
            "retry": self.retry,
            "timeout": self.timeout,
            "recovery": self.recovery,
            "logging": self.logging,
            "app": self.app,
        }
        for name, obj in section_map.items():
            section_data = data.get(name, {})
            if isinstance(section_data, dict):
                for key, value in section_data.items():
                    if hasattr(obj, key):
                        setattr(obj, key, value)

        # Flat key compatibility with existing test YAML format
        if "retry_attempts" in data:
            self.retry.retry_attempts = data["retry_attempts"]
        if "retry_delay" in data:
            self.retry.retry_delay = data["retry_delay"]
