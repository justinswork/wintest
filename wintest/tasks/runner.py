import logging
import os
import re
import time
from datetime import datetime
from typing import Optional

from .schema import TaskDefinition, TaskResult, StepResult
from ..core.agent import Agent
from ..core.app_manager import ApplicationManager, AppConfig
from ..core.recovery import RecoveryStrategy
from ..config.settings import Settings
from ..reporting.reporter import ReportGenerator

logger = logging.getLogger(__name__)


class TaskRunner:
    """Runs a complete task definition through the agent."""

    def __init__(self, agent: Agent, settings: Settings = None):
        self.agent = agent
        self.settings = settings or Settings()
        self.skip_report = False
        self._app_manager: Optional[ApplicationManager] = None
        self._recovery: Optional[RecoveryStrategy] = None

    def run(self, task: TaskDefinition, progress_callback=None) -> TaskResult:
        """Execute all steps in a task definition."""
        effective = self.settings.merge_task_settings(task.settings)

        report_dir = self._create_report_dir(task.name)
        self.agent.report_dir = report_dir

        logger.info("=" * 40)
        logger.info("TASK: %s", task.name)
        logger.info("STEPS: %d", len(task.steps))
        logger.info("=" * 40)

        # Set up application manager and recovery
        if task.application:
            app_config = AppConfig(
                path=task.application["path"],
                title=task.application.get("title"),
                wait_after_launch=task.application.get(
                    "wait_after_launch", effective.app.wait_after_launch
                ),
            )
            self._app_manager = ApplicationManager(
                config=app_config,
                graceful_close_timeout=effective.app.graceful_close_timeout,
                focus_delay=effective.app.focus_delay,
            )
            self._app_manager.launch()

            if effective.recovery.enabled:
                self._recovery = RecoveryStrategy(
                    app_manager=self._app_manager,
                    actions=self.agent.actions,
                    max_attempts=effective.recovery.max_recovery_attempts,
                    dismiss_keys=effective.recovery.dismiss_dialog_keys,
                    recovery_delay=effective.recovery.recovery_delay,
                )

        fail_fast = task.settings.get("fail_fast", True)
        task_deadline = time.time() + effective.timeout.task_timeout
        results = []

        for i, step in enumerate(task.steps, 1):
            # Task-level timeout check
            if time.time() > task_deadline:
                logger.error(
                    "Task timeout (%.0fs) exceeded.", effective.timeout.task_timeout
                )
                results.append(StepResult(
                    step=step,
                    passed=False,
                    error=f"Task timeout ({effective.timeout.task_timeout}s) exceeded",
                ))
                break

            # Focus the app before each step
            if self._app_manager:
                self._app_manager.focus()

            label = step.description or step.action.value
            logger.info("[Step %d/%d] %s...", i, len(task.steps), label)

            if progress_callback:
                progress_callback.on_step_start(i, label)

            step_timeout = step.timeout or effective.timeout.step_timeout
            result = self.agent.execute_step(step, step_timeout=step_timeout)

            # Attempt recovery on failure
            if not result.passed and self._recovery:
                logger.warning("Step failed, attempting recovery...")
                if self._recovery.attempt_recovery():
                    logger.info("Recovery succeeded, retrying step...")
                    result = self.agent.execute_step(
                        step, step_timeout=step_timeout
                    )

            results.append(result)

            if progress_callback:
                progress_callback.on_step_complete(i, result)

            status = "PASS" if result.passed else "FAIL"
            logger.info("  -> %s (%.1fs)", status, result.duration_seconds)

            if result.coordinates:
                logger.info("     Clicked at: %s", result.coordinates)
            if result.error:
                logger.error("     Error: %s", result.error)
            if result.model_response and not result.passed:
                logger.debug("     Model said: %s", result.model_response)

            if not result.passed and fail_fast:
                logger.info("Fail-fast enabled, stopping execution.")
                break

        task_result = TaskResult(task_name=task.name, step_results=results)
        self._print_summary(task_result)

        # Generate reports
        if not self.skip_report:
            reporter = ReportGenerator(report_dir)
            html_path = reporter.generate(task_result)
            logger.info("Report: %s", html_path)

        if self._app_manager:
            self._app_manager.close()

        return task_result

    @staticmethod
    def _create_report_dir(task_name: str) -> str:
        """Create a timestamped report directory under reports/."""
        safe_name = re.sub(r"[^\w\-]", "_", task_name)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        report_dir = os.path.join("reports", f"{timestamp}_{safe_name}")
        os.makedirs(report_dir, exist_ok=True)
        return report_dir

    @staticmethod
    def _print_summary(result: TaskResult):
        """Print a summary of the task results."""
        summary = result.summary
        status = "PASSED" if result.passed else "FAILED"
        logger.info("=" * 40)
        logger.info("RESULT: %s", status)
        logger.info(
            "  %d/%d steps passed, %d failed",
            summary["passed"], summary["total"], summary["failed"],
        )
        logger.info("=" * 40)
