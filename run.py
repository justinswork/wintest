import logging
import sys
import torch

from wintest.config.settings import Settings
from wintest.config.logging import setup_logging
from wintest.core.vision import VisionModel
from wintest.core.screen import ScreenCapture
from wintest.core.actions import ActionExecutor
from wintest.core.agent import Agent
from wintest.tasks.loader import load_task
from wintest.tasks.runner import TaskRunner

if __name__ == "__main__":
    # --- Load configuration ---
    settings = Settings.load("config.yaml")
    setup_logging(
        level=settings.logging.level,
        log_file=settings.logging.log_file,
    )
    logger = logging.getLogger(__name__)

    # --- Initialize components ---
    vision = VisionModel(model_settings=settings.model)
    vision.load()

    screen = ScreenCapture(coordinate_scale=settings.action.coordinate_scale)
    actions = ActionExecutor(action_settings=settings.action)

    logger.info("Success! System Online.")
    logger.info("CUDA Available: %s", torch.cuda.is_available())
    if torch.cuda.is_available():
        logger.info("GPU Name: %s", torch.cuda.get_device_name(0))
    else:
        logger.info("GPU Name: None")

    # --- Task mode: run a YAML task file ---
    if len(sys.argv) > 1:
        task_file = sys.argv[1]
        logger.info("Loading task: %s", task_file)
        task = load_task(task_file, settings=settings)

        agent = Agent(vision, screen, actions)
        runner = TaskRunner(agent, settings=settings)
        result = runner.run(task)

        sys.exit(0 if result.passed else 1)

    # --- Demo mode: find a single element ---
    target = "Windows Start button"
    logger.info("Scanning screen for: '%s'...", target)

    screenshot = screen.capture()
    result = vision.find_element(screenshot, target)

    logger.info("-" * 30)
    logger.info("TARGET: %s", target)
    logger.info("AI RESPONSE: %s", result["raw_response"])

    if result["coordinates"]:
        x_norm, y_norm = result["coordinates"]
        px, py = screen.normalized_to_pixel(x_norm, y_norm)
        logger.info("PARSED COORDS: [%d, %d] -> pixel (%d, %d)",
                     x_norm, y_norm, px, py)
    else:
        logger.info("Could not parse coordinates from response.")
    logger.info("-" * 30)
