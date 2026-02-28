"""Interactive REPL for live natural language UI commands."""

import re

import click

from ..config.settings import Settings
from ..core.vision import VisionModel
from ..core.screen import ScreenCapture
from ..core.actions import ActionExecutor
from ..core.agent import Agent
from ..tasks.schema import Step, ActionType
from . import console

# Command patterns: "click <target>", "type <text>", etc.
COMMAND_PATTERNS = [
    (r"^click\s+(.+)$", ActionType.CLICK),
    (r"^double[- ]?click\s+(.+)$", ActionType.DOUBLE_CLICK),
    (r"^right[- ]?click\s+(.+)$", ActionType.RIGHT_CLICK),
    (r"^type\s+(.+)$", ActionType.TYPE),
    (r"^press\s+(.+)$", ActionType.PRESS_KEY),
    (r"^hotkey\s+(.+)$", ActionType.HOTKEY),
    (r"^scroll\s+(up|down)(?:\s+(\d+))?$", ActionType.SCROLL),
    (r"^wait\s+([\d.]+)$", ActionType.WAIT),
    (r"^verify\s+(.+)$", ActionType.VERIFY),
]


def parse_command(text: str) -> Step | None:
    """
    Parse a command string into a Step.

    Supported formats:
        click File menu
        double-click icon
        right-click desktop
        type Hello World
        press enter
        hotkey ctrl+c
        scroll up 3
        scroll down
        wait 2.5
        verify Save button
    """
    text = text.strip()
    if not text:
        return None

    for pattern, action_type in COMMAND_PATTERNS:
        match = re.match(pattern, text, re.IGNORECASE)
        if not match:
            continue

        if action_type in (
            ActionType.CLICK, ActionType.DOUBLE_CLICK,
            ActionType.RIGHT_CLICK, ActionType.VERIFY,
        ):
            return Step(action=action_type, target=match.group(1).strip())

        if action_type == ActionType.TYPE:
            return Step(action=action_type, text=match.group(1))

        if action_type == ActionType.PRESS_KEY:
            return Step(action=action_type, key=match.group(1).strip().lower())

        if action_type == ActionType.HOTKEY:
            keys = [
                k.strip().lower()
                for k in match.group(1).replace("+", " ").split()
            ]
            return Step(action=action_type, keys=keys)

        if action_type == ActionType.SCROLL:
            direction = match.group(1).lower()
            amount = int(match.group(2)) if match.group(2) else 3
            return Step(
                action=action_type,
                scroll_amount=amount if direction == "up" else -amount,
            )

        if action_type == ActionType.WAIT:
            return Step(action=action_type, wait_seconds=float(match.group(1)))

    return None


def run_interactive(settings: Settings) -> None:
    """Launch the interactive REPL."""
    console.header("\n  wintest interactive mode\n")
    console.info("Loading AI model (this may take a minute)...")

    vision = VisionModel(model_settings=settings.model)
    vision.load()

    screen = ScreenCapture(coordinate_scale=settings.action.coordinate_scale)
    actions = ActionExecutor(action_settings=settings.action)
    agent = Agent(vision, screen, actions)

    console.success("Model loaded. Type commands or 'help' for usage. 'quit' to exit.\n")

    while True:
        try:
            text = click.prompt("wintest", prompt_suffix="> ", type=str)
        except (EOFError, KeyboardInterrupt):
            console.info("\nGoodbye.")
            break

        text = text.strip()
        if not text:
            continue
        if text.lower() in ("quit", "exit", "q"):
            console.info("Goodbye.")
            break
        if text.lower() == "help":
            _print_help()
            continue

        step = parse_command(text)
        if step is None:
            console.warning(f"Could not parse command: '{text}'")
            console.info("Type 'help' for supported commands.")
            continue

        console.info(f"  Executing: {step.action.value}...")
        result = agent.execute_step(step, step_timeout=settings.timeout.step_timeout)

        if result.passed:
            console.success(f"  Done ({result.duration_seconds:.1f}s)")
            if result.coordinates:
                console.info(f"  Clicked at: {result.coordinates}")
        else:
            console.error(f"Failed: {result.error}")


def _print_help() -> None:
    """Print interactive mode help."""
    console.header("\nSupported commands:")
    commands = [
        ("click <target>",        "Click on a UI element"),
        ("double-click <target>", "Double-click on a UI element"),
        ("right-click <target>",  "Right-click on a UI element"),
        ("type <text>",           "Type text at the current cursor"),
        ("press <key>",           "Press a keyboard key (enter, tab, escape, ...)"),
        ("hotkey <key1+key2>",    "Press a key combination (ctrl+c, alt+f4, ...)"),
        ("scroll up [amount]",    "Scroll up (default: 3 clicks)"),
        ("scroll down [amount]",  "Scroll down (default: 3 clicks)"),
        ("wait <seconds>",        "Wait for a duration"),
        ("verify <target>",       "Verify a UI element is visible"),
        ("help",                  "Show this help message"),
        ("quit",                  "Exit interactive mode"),
    ]
    for cmd, desc in commands:
        click.echo(f"  {click.style(cmd, bold=True):32s} {desc}")
    click.echo("")
