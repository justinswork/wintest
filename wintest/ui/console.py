"""Colored terminal output utilities for the wintest CLI."""

import click
import colorama


def init():
    """Initialize colorama for cross-platform ANSI support on Windows."""
    colorama.init()


def info(message: str) -> None:
    """Print an informational message."""
    click.echo(message)


def success(message: str) -> None:
    """Print a success message in green."""
    click.echo(click.style(message, fg="green"))


def warning(message: str) -> None:
    """Print a warning message in yellow."""
    click.echo(click.style(message, fg="yellow"))


def error(message: str) -> None:
    """Print an error message in red to stderr."""
    click.echo(click.style(f"Error: {message}", fg="red"), err=True)


def step_pass(step_num: int, total: int, label: str, duration: float) -> None:
    """Print a passing step result with green PASS badge."""
    badge = click.style(" PASS ", fg="white", bg="green", bold=True)
    click.echo(f"  [{step_num}/{total}] {badge} {label} ({duration:.1f}s)")


def step_fail(
    step_num: int, total: int, label: str, duration: float, err_msg: str = ""
) -> None:
    """Print a failing step result with red FAIL badge."""
    badge = click.style(" FAIL ", fg="white", bg="red", bold=True)
    click.echo(f"  [{step_num}/{total}] {badge} {label} ({duration:.1f}s)")
    if err_msg:
        click.echo(click.style(f"         {err_msg}", fg="red"))


def task_result_banner(task_name: str, passed: bool, summary: dict) -> None:
    """Print the final task result banner."""
    if passed:
        status = click.style("PASSED", fg="green", bold=True)
    else:
        status = click.style("FAILED", fg="red", bold=True)
    click.echo("")
    click.echo("=" * 50)
    click.echo(f"  {task_name}: {status}")
    click.echo(
        f"  {summary['passed']}/{summary['total']} steps passed, "
        f"{summary['failed']} failed"
    )
    click.echo("=" * 50)


def header(text: str) -> None:
    """Print a section header in bold."""
    click.echo(click.style(text, bold=True))
