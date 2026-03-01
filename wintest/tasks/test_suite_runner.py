"""Runner for test suites — executes each test in sequence."""

import logging
import os

from .schema import TestSuiteDefinition, TestSuiteResult, TestResult
from .loader import load_test
from .runner import TestRunner
from ..config.settings import Settings

logger = logging.getLogger(__name__)

TESTS_DIR = "tests"


class TestSuiteRunner:
    """Runs all tests in a test suite sequentially."""

    def __init__(self, runner: TestRunner, settings: Settings = None):
        self.runner = runner
        self.settings = settings or Settings()

    def run(
        self,
        suite: TestSuiteDefinition,
        progress_callback=None,
        on_test_start=None,
        on_test_complete=None,
        cancel_check=None,
    ) -> TestSuiteResult:
        """Execute all tests in a suite.

        Args:
            suite: The test suite definition to run.
            progress_callback: Per-step progress callback (passed to TestRunner).
            on_test_start: Called with (test_index, test_name, total_tests).
            on_test_complete: Called with (test_index, test_result).
        """
        fail_fast = suite.settings.get("fail_fast", False)
        results: list[TestResult] = []

        logger.info("=" * 40)
        logger.info("SUITE: %s", suite.name)
        logger.info("TESTS: %d", len(suite.test_paths))
        logger.info("=" * 40)

        for i, test_path in enumerate(suite.test_paths, 1):
            # Cancellation check
            if cancel_check and cancel_check():
                logger.info("Suite run cancelled by user.")
                break

            full_path = os.path.join(TESTS_DIR, test_path)

            try:
                test = load_test(full_path, settings=self.settings)
            except (ValueError, FileNotFoundError) as e:
                logger.error("Failed to load test %s: %s", test_path, e)
                # Create a failed result for the unloadable test
                result = TestResult(
                    test_name=test_path,
                    step_results=[],
                )
                results.append(result)
                if on_test_complete:
                    on_test_complete(i, result)
                if fail_fast:
                    logger.info("Fail-fast enabled, stopping suite.")
                    break
                continue

            logger.info(
                "[Test %d/%d] %s (%d steps)",
                i, len(suite.test_paths), test.name, len(test.steps),
            )

            if on_test_start:
                on_test_start(i, test.name, len(suite.test_paths))

            result = self.runner.run(test, progress_callback=progress_callback)
            results.append(result)

            if on_test_complete:
                on_test_complete(i, result)

            status = "PASSED" if result.passed else "FAILED"
            logger.info("  -> %s: %s", test.name, status)

            if not result.passed and fail_fast:
                logger.info("Fail-fast enabled, stopping suite.")
                break

        suite_result = TestSuiteResult(
            suite_name=suite.name,
            test_results=results,
        )
        self._print_summary(suite_result)
        return suite_result

    @staticmethod
    def _print_summary(result: TestSuiteResult):
        summary = result.summary
        status = "PASSED" if result.passed else "FAILED"
        logger.info("=" * 40)
        logger.info("SUITE RESULT: %s", status)
        logger.info(
            "  %d/%d tests passed, %d failed",
            summary["passed"], summary["total_tests"], summary["failed"],
        )
        logger.info("=" * 40)
