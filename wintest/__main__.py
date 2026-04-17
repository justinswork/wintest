"""Allow `python -m wintest ...` as an alternative to the `wintest` console script."""

from .ui.cli import cli

if __name__ == "__main__":
    cli()
