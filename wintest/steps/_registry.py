"""Auto-discovery registry for step definitions."""

import importlib
import pkgutil
from pathlib import Path

from ._base import StepDefinition

_STEPS: dict[str, StepDefinition] = {}


def _discover():
    """Scan this package for step definition modules and register them."""
    package_dir = Path(__file__).parent

    for info in pkgutil.iter_modules([str(package_dir)]):
        if info.name.startswith("_"):
            continue
        module = importlib.import_module(f".{info.name}", package=__package__)
        defn = getattr(module, "definition", None)
        if isinstance(defn, StepDefinition):
            _STEPS[defn.name] = defn


def get(name: str) -> StepDefinition | None:
    """Look up a step definition by action name."""
    return _STEPS.get(name)


def all_definitions() -> list[StepDefinition]:
    """Return all registered step definitions in insertion order."""
    return list(_STEPS.values())


def action_names() -> list[str]:
    """Return all registered action names."""
    return list(_STEPS.keys())


# Auto-discover on import
_discover()
