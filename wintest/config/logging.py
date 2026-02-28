import logging
import sys


def setup_logging(level: str = "INFO", log_file: str = None) -> None:
    """
    Configure the root 'wintest' logger.

    Args:
        level: One of DEBUG, INFO, WARNING, ERROR.
        log_file: Optional path to a log file. If provided, logs go to
                  both the console and the file.
    """
    logger = logging.getLogger("wintest")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.handlers.clear()

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)-5s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    logger.addHandler(console)

    if log_file:
        fh = logging.FileHandler(log_file)
        fh.setFormatter(formatter)
        logger.addHandler(fh)
