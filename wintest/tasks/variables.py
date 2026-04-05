"""Variable store for test runs — holds and resolves {{var}} placeholders."""

import copy
import re
import logging

from .schema import Step

logger = logging.getLogger(__name__)

_PATTERN = re.compile(r"\{\{(\w+)\}\}")


class VariableStore:
    """Stores variables and resolves placeholders in step fields."""

    def __init__(self, initial: dict[str, str] | None = None):
        self._vars: dict[str, str] = {}
        if initial:
            for k, v in initial.items():
                self._vars[k] = str(v)

    def set(self, name: str, value: str) -> None:
        self._vars[name] = str(value)
        logger.debug("Variable set: %s = %r", name, value)

    def get(self, name: str) -> str | None:
        return self._vars.get(name)

    def all(self) -> dict[str, str]:
        return dict(self._vars)

    def resolve_string(self, text: str) -> str:
        """Replace all {{var}} placeholders in a string."""
        def _replace(match):
            name = match.group(1)
            value = self._vars.get(name)
            if value is None:
                logger.warning("Undefined variable: {{%s}}", name)
                return match.group(0)  # leave unresolved
            return value
        return _PATTERN.sub(_replace, text)

    def resolve_step(self, step: Step) -> Step:
        """Return a copy of the step with all string fields resolved."""
        resolved = copy.copy(step)
        for field_name in ("target", "text", "description", "key", "app_path", "app_title"):
            value = getattr(resolved, field_name, None)
            if isinstance(value, str) and "{{" in value:
                setattr(resolved, field_name, self.resolve_string(value))
        # Resolve keys list
        if resolved.keys:
            resolved.keys = [
                self.resolve_string(k) if "{{" in k else k
                for k in resolved.keys
            ]
        return resolved
