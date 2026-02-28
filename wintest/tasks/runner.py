import logging
import os
import re
import time
from datetime import datetime
from typing import Optional

from .schema import TestDefinition, TestResult, StepResult
from ..steps import registry
from ..core.agent import Agent
from ..config.settings import Settings
from ..reporting.reporter import ReportGenerator

logger = logging.getLogger(__name__)


class TestRunner:
    """Runs a complete test definition through the agent."""

    def __init__(self, agent: Agent, settings: Settings = None):
        self.agent = agent
        self.settings = settings or Settings()
        self.skip_report = False
        self._app_manager: Optional[ApplicationManager] = None
        self._recovery: Optional[RecoveryStrategy] = None

    def run(self, test: TestDefinition, progress_callback=None) -> TestResult:
        """Execute all steps in a test definition."""
        effective = self.settings.merge_test_settings(test.settings)

        report_dir = self._create_report_dir(test.name)
        self.agent.report_dir = report_dir

        logger.info("=" * 40)
        logger.info("TEST: %s", test.name)
        logger.info("STEPS: %d", len(test.steps))
        logger.info("=" * 40)

        fail_fast = test.settings.get("fail_fast", True)
        test_deadline = time.time() + effective.timeout.test_timeout
        results = []

        for i, step in enumerate(test.steps, 1):
            # Test-level timeout check
            if time.time() > test_deadline:
                logger.error(
                    "Test timeout (%.0fs) exceeded.", effective.timeout.test_timeout
                )
                results.append(StepResult(
                    step=step,
                    passed=False,
                    error=f"Test timeout ({effective.timeout.test_timeout}s) exceeded",
                ))
                break

            # Focus the app before each step
            if self._app_manager:
                self._app_manager.focus()

            label = step.description or step.action
            logger.info("[Step %d/%d] %s...", i, len(test.steps), label)

            if progress_callback:
                progress_callback.on_step_start(i, label)

            defn = registry.get(step.action)

            # Handle runner-level steps (e.g. launch_application)
            if defn and defn.is_runner_step:
                start = time.time()
                try:
                    runner_ctx = {
                        "effective_settings": effective,
                        "agent": self.agent,
                        "app_manager": self._app_manager,
                        "recovery": self._recovery,
                    }
                    result = defn.execute(step, runner_ctx)
                    # Pick up any state changes from the step
                    self._app_manager = runner_ctx.get("app_manager")
                    self._recovery = runner_ctx.get("recovery")
                except Exception as e:
                    result = StepResult(step=step, passed=False, error=str(e))
                result.duration_seconds = time.time() - start

                results.append(result)
                if progress_callback:
                    progress_callback.on_step_complete(i, result)
                status = "PASS" if result.passed else "FAIL"
                logger.info("  -> %s (%.1fs)", status, result.duration_seconds)
                if result.error:
                    logger.error("     Error: %s", result.error)
                if not result.passed and fail_fast:
                    logger.info("Fail-fast enabled, stopping execution.")
                    break
                continue

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

        test_result = TestResult(test_name=test.name, step_results=results)
        self._print_summary(test_result)

        # Generate reports
        if not self.skip_report:
            reporter = ReportGenerator(report_dir)
            html_path = reporter.generate(test_result)
            logger.info("Report: %s", html_path)

        if self._app_manager:
            self._app_manager.close()

        return test_result

    @staticmethod
    def _create_report_dir(test_name: str) -> str:
        """Create a timestamped report directory under reports/."""
        safe_name = re.sub(r"[^\w\-]", "_", test_name)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        report_dir = os.path.join("reports", f"{timestamp}_{safe_name}")
        os.makedirs(report_dir, exist_ok=True)
        return report_dir

    @staticmethod
    def _print_summary(result: TestResult):
        """Print a summary of the test results."""
        summary = result.summary
        status = "PASSED" if result.passed else "FAILED"
        logger.info("=" * 40)
        logger.info("RESULT: %s", status)
        logger.info(
            "  %d/%d steps passed, %d failed",
            summary["passed"], summary["total"], summary["failed"],
        )
        logger.info("=" * 40)
