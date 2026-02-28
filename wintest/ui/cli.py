"""
wintest -- Windows UI Testing CLI

Entry point: `wintest` console script defined in pyproject.toml.
"""

import os
import sys

import click

from ..config.logging import setup_logging
from ..config.settings import Settings
from ..tasks.schema import ActionType
from . import console


@click.group()
@click.option(
    "--config", "-c",
    default="config.yaml",
    type=click.Path(),
    help="Path to global config file (default: config.yaml).",
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    default=False,
    help="Enable verbose (DEBUG) logging.",
)
@click.pass_context
def cli(ctx, config, verbose):
    """wintest -- AI-powered Windows UI testing tool."""
    console.init()
    ctx.ensure_object(dict)

    settings = Settings.load(config)
    if verbose:
        settings.logging.level = "DEBUG"

    setup_logging(
        level=settings.logging.level,
        log_file=settings.logging.log_file,
    )

    ctx.obj["settings"] = settings


# -- wintest run ----------------------------------------------------

@cli.command()
@click.argument("task_file", type=click.Path(exists=True))
@click.option("--no-report", is_flag=True, help="Skip report generation.")
@click.option("--no-app", is_flag=True, help="Skip application launch/close.")
@click.pass_context
def run(ctx, task_file, no_report, no_app):
    """Execute a test task from a YAML file."""
    settings = ctx.obj["settings"]

    from ..core.vision import VisionModel
    from ..core.screen import ScreenCapture
    from ..core.actions import ActionExecutor
    from ..core.agent import Agent
    from ..tasks.loader import load_task
    from ..tasks.runner import TaskRunner
    from .progress import ProgressDisplay

    console.header(f"\n  wintest run: {task_file}\n")

    try:
        task = load_task(task_file, settings=settings)
    except ValueError as e:
        console.error(str(e))
        sys.exit(2)

    console.info("Loading AI model...")
    vision = VisionModel(model_settings=settings.model)
    vision.load()
    console.success("Model loaded.")

    screen = ScreenCapture(coordinate_scale=settings.action.coordinate_scale)
    actions = ActionExecutor(action_settings=settings.action)
    agent = Agent(vision, screen, actions)

    runner = TaskRunner(agent, settings=settings)

    if no_app and task.application:
        task.application = None

    if no_report:
        runner.skip_report = True

    console.info(f"Task: {task.name}")
    console.info(f"Steps: {len(task.steps)}")

    progress = ProgressDisplay(total_steps=len(task.steps))
    result = runner.run(task, progress_callback=progress)

    console.task_result_banner(task.name, result.passed, result.summary)

    sys.exit(0 if result.passed else 1)


# -- wintest validate -----------------------------------------------

@cli.command()
@click.argument("task_file", type=click.Path(exists=True))
@click.pass_context
def validate(ctx, task_file):
    """Validate a task YAML file for errors."""
    settings = ctx.obj["settings"]

    from ..tasks.loader import load_task
    from ..tasks.validator import validate_task

    console.header(f"\n  Validating: {task_file}\n")

    try:
        task = load_task(task_file, settings=settings)
    except ValueError as e:
        console.error(f"Structural error: {e}")
        sys.exit(1)

    console.success("Structure: OK (name, steps, action types)")

    issues = validate_task(task)
    if issues:
        console.warning(f"Found {len(issues)} issue(s):")
        for issue in issues:
            console.warning(f"  - {issue}")
        sys.exit(1)

    console.success(f"Semantics: OK ({len(task.steps)} steps validated)")
    console.success(f"\n  {task_file} is valid.\n")


# -- wintest init ---------------------------------------------------

@cli.command()
@click.argument("output", default="task.yaml", type=click.Path())
@click.option("--force", "-f", is_flag=True, help="Overwrite existing file.")
def init(output, force):
    """Generate a template task YAML file."""
    from .templates import TASK_TEMPLATE

    if os.path.exists(output) and not force:
        console.error(f"File already exists: {output}. Use --force to overwrite.")
        sys.exit(1)

    with open(output, "w") as f:
        f.write(TASK_TEMPLATE)

    console.success(f"Created template: {output}")
    console.info("Edit this file to define your test steps, then run:")
    console.info(f"  wintest validate {output}")
    console.info(f"  wintest run {output}")


# -- wintest list-actions --------------------------------------------

ACTION_DESCRIPTIONS = {
    ActionType.CLICK:        "Click on a UI element identified by the AI model",
    ActionType.DOUBLE_CLICK: "Double-click on a UI element",
    ActionType.RIGHT_CLICK:  "Right-click on a UI element",
    ActionType.TYPE:         "Type text at the current cursor position",
    ActionType.PRESS_KEY:    "Press a single keyboard key (enter, tab, escape, ...)",
    ActionType.HOTKEY:       "Press a key combination (ctrl+c, alt+f4, ...)",
    ActionType.SCROLL:       "Scroll the mouse wheel (positive=up, negative=down)",
    ActionType.WAIT:         "Pause execution for a specified duration",
    ActionType.VERIFY:       "Verify that a UI element is visible (or not visible)",
}

ACTION_REQUIRED_FIELDS = {
    ActionType.CLICK:        ["target"],
    ActionType.DOUBLE_CLICK: ["target"],
    ActionType.RIGHT_CLICK:  ["target"],
    ActionType.TYPE:         ["text"],
    ActionType.PRESS_KEY:    ["key"],
    ActionType.HOTKEY:       ["keys"],
    ActionType.SCROLL:       ["scroll_amount"],
    ActionType.WAIT:         ["wait_seconds"],
    ActionType.VERIFY:       ["target"],
}


@cli.command("list-actions")
def list_actions():
    """Show all available action types with descriptions."""
    console.header("\n  Available Actions\n")

    for action in ActionType:
        name = click.style(action.value, bold=True)
        desc = ACTION_DESCRIPTIONS.get(action, "")
        click.echo(f"  {name:24s} {desc}")

        fields = ACTION_REQUIRED_FIELDS.get(action, [])
        if fields:
            click.echo(click.style(
                f"  {'':24s} Required: {', '.join(fields)}",
                fg="bright_black",
            ))

    click.echo("")


# -- wintest interactive ---------------------------------------------

@cli.command()
@click.pass_context
def interactive(ctx):
    """Start interactive mode -- type commands, AI executes them live."""
    settings = ctx.obj["settings"]
    from .interactive import run_interactive
    run_interactive(settings)
