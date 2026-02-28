"""
wintest -- Windows UI Testing CLI

Entry point: `wintest` console script defined in pyproject.toml.
"""

import os
import sys

import click

from ..config.logging import setup_logging
from ..config.settings import Settings
from ..steps import registry
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
@click.argument("test_file", type=click.Path(exists=True))
@click.option("--no-report", is_flag=True, help="Skip report generation.")
@click.pass_context
def run(ctx, test_file, no_report):
    """Execute a test from a YAML file."""
    settings = ctx.obj["settings"]

    from ..core.vision import VisionModel
    from ..core.screen import ScreenCapture
    from ..core.actions import ActionExecutor
    from ..core.agent import Agent
    from ..tasks.loader import load_test
    from ..tasks.runner import TestRunner
    from .progress import ProgressDisplay

    console.header(f"\n  wintest run: {test_file}\n")

    try:
        test = load_test(test_file, settings=settings)
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

    runner = TestRunner(agent, settings=settings)

    if no_report:
        runner.skip_report = True

    console.info(f"Test: {test.name}")
    console.info(f"Steps: {len(test.steps)}")

    progress = ProgressDisplay(total_steps=len(test.steps))
    result = runner.run(test, progress_callback=progress)

    console.test_result_banner(test.name, result.passed, result.summary)

    sys.exit(0 if result.passed else 1)


# -- wintest run-test-suite ------------------------------------------

@cli.command("run-test-suite")
@click.argument("suite_file", type=click.Path(exists=True))
@click.option("--no-report", is_flag=True, help="Skip report generation.")
@click.pass_context
def run_test_suite(ctx, suite_file, no_report):
    """Execute a test suite from a YAML file."""
    settings = ctx.obj["settings"]

    from ..core.vision import VisionModel
    from ..core.screen import ScreenCapture
    from ..core.actions import ActionExecutor
    from ..core.agent import Agent
    from ..tasks.test_suite_loader import load_test_suite
    from ..tasks.test_suite_runner import TestSuiteRunner
    from ..tasks.runner import TestRunner

    console.header(f"\n  wintest run-test-suite: {suite_file}\n")

    try:
        suite = load_test_suite(suite_file)
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

    runner = TestRunner(agent, settings=settings)
    if no_report:
        runner.skip_report = True

    suite_runner = TestSuiteRunner(runner, settings=settings)

    console.info(f"Suite: {suite.name}")
    console.info(f"Tests: {len(suite.test_paths)}")

    def on_test_start(idx, name, total):
        console.info(f"\n[Test {idx}/{total}] {name}")

    def on_test_complete(idx, result):
        status = "PASS" if result.passed else "FAIL"
        summary = result.summary
        console.info(
            f"  -> {status}: {summary['passed']}/{summary['total']} steps passed"
        )

    suite_result = suite_runner.run(
        suite,
        on_test_start=on_test_start,
        on_test_complete=on_test_complete,
    )

    console.test_suite_result_banner(
        suite.name, suite_result.passed, suite_result.summary
    )

    sys.exit(0 if suite_result.passed else 1)


# -- wintest validate -----------------------------------------------

@cli.command()
@click.argument("test_file", type=click.Path(exists=True))
@click.pass_context
def validate(ctx, test_file):
    """Validate a test YAML file for errors."""
    settings = ctx.obj["settings"]

    from ..tasks.loader import load_test
    from ..tasks.validator import validate_test

    console.header(f"\n  Validating: {test_file}\n")

    try:
        test = load_test(test_file, settings=settings)
    except ValueError as e:
        console.error(f"Structural error: {e}")
        sys.exit(1)

    console.success("Structure: OK (name, steps, step types)")

    issues = validate_test(test)
    if issues:
        console.warning(f"Found {len(issues)} issue(s):")
        for issue in issues:
            console.warning(f"  - {issue}")
        sys.exit(1)

    console.success(f"Semantics: OK ({len(test.steps)} steps validated)")
    console.success(f"\n  {test_file} is valid.\n")


# -- wintest init ---------------------------------------------------

@cli.command()
@click.argument("output", default="test.yaml", type=click.Path())
@click.option("--force", "-f", is_flag=True, help="Overwrite existing file.")
def init(output, force):
    """Generate a template test YAML file."""
    from .templates import TEST_TEMPLATE

    if os.path.exists(output) and not force:
        console.error(f"File already exists: {output}. Use --force to overwrite.")
        sys.exit(1)

    with open(output, "w") as f:
        f.write(TEST_TEMPLATE)

    console.success(f"Created template: {output}")
    console.info("Edit this file to define your test steps, then run:")
    console.info(f"  wintest validate {output}")
    console.info(f"  wintest run {output}")


# -- wintest list-steps ---------------------------------------------

@cli.command("list-steps")
def list_steps():
    """Show all available step types with descriptions."""
    console.header("\n  Available Steps\n")

    for defn in registry.all_definitions():
        name = click.style(defn.name, bold=True)
        click.echo(f"  {name:24s} {defn.description}")

        required = [f.name for f in defn.fields if f.required]
        if required:
            click.echo(click.style(
                f"  {'':24s} Required: {', '.join(required)}",
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


# -- wintest web ----------------------------------------------------

@cli.command()
@click.option("--host", default="127.0.0.1", help="Host to bind to.")
@click.option("--port", default=8080, type=int, help="Port to listen on.")
@click.pass_context
def web(ctx, host, port):
    """Launch the web UI."""
    settings = ctx.obj["settings"]
    from .web.server import start_server
    start_server(settings, host=host, port=port)
