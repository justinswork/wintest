import os
import re
import subprocess
import time
import ctypes
import ctypes.wintypes
from datetime import datetime

from .schema import TaskDefinition, TaskResult
from ..core.agent import Agent
from ..reporting.reporter import ReportGenerator


class TaskRunner:
    """Runs a complete task definition through the agent."""

    def __init__(self, agent: Agent):
        self.agent = agent
        self._app_title = None

    def run(self, task: TaskDefinition) -> TaskResult:
        """Execute all steps in a task definition."""
        # Create timestamped report directory
        report_dir = self._create_report_dir(task.name)
        self.agent.report_dir = report_dir

        print(f"\n{'=' * 40}")
        print(f"TASK: {task.name}")
        print(f"STEPS: {len(task.steps)}")
        print(f"{'=' * 40}\n")

        if task.application:
            self._launch_application(task.application)
            self._app_title = task.application.get("title")

        fail_fast = task.settings.get("fail_fast", True)
        results = []

        for i, step in enumerate(task.steps, 1):
            if self._app_title:
                self._focus_window(self._app_title)
                time.sleep(0.3)

            label = step.description or step.action.value
            print(f"[Step {i}/{len(task.steps)}] {label}...")

            result = self.agent.execute_step(step)
            results.append(result)

            status = "PASS" if result.passed else "FAIL"
            print(f"  -> {status} ({result.duration_seconds:.1f}s)")

            if result.coordinates:
                print(f"     Clicked at: {result.coordinates}")
            if result.error:
                print(f"     Error: {result.error}")
            if result.model_response and not result.passed:
                print(f"     Model said: {result.model_response}")

            if not result.passed and fail_fast:
                print("\n  Fail-fast enabled, stopping execution.")
                break

        task_result = TaskResult(task_name=task.name, step_results=results)
        self._print_summary(task_result)

        # Generate reports
        reporter = ReportGenerator(report_dir)
        html_path = reporter.generate(task_result)
        print(f"\nReport: {html_path}")

        if task.application:
            self._close_application(task.application)

        return task_result

    @staticmethod
    def _create_report_dir(task_name: str) -> str:
        """Create a timestamped report directory under reports/."""
        safe_name = re.sub(r"[^\w\-]", "_", task_name)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        report_dir = os.path.join("reports", f"{timestamp}_{safe_name}")
        os.makedirs(report_dir, exist_ok=True)
        return report_dir

    def _launch_application(self, app_config: dict):
        """Close any existing instances and launch the application fresh."""
        title = app_config.get("title")
        path = app_config["path"]

        # Kill existing instances for a clean state
        if title and self._find_window(title):
            exe_name = path.split("/")[-1].split("\\")[-1]
            print(f"Closing existing '{title}' windows...")
            import os
            os.system(f'taskkill /IM {exe_name} /F >nul 2>&1')
            time.sleep(1)

        wait = app_config.get("wait_after_launch", 3)
        print(f"Launching: {path}")
        subprocess.Popen(path, shell=True)
        print(f"Waiting {wait}s for application to start...")
        time.sleep(wait)

    @staticmethod
    def _close_application(app_config: dict):
        """Close the application after the test run."""
        exe_name = app_config["path"].split("/")[-1].split("\\")[-1]
        print(f"\nClosing: {exe_name}")
        import os
        os.system(f'taskkill /IM {exe_name} /F >nul 2>&1')

    @staticmethod
    def _find_window(title_substring: str) -> bool:
        """Check if a window matching the title exists."""
        user32 = ctypes.windll.user32
        found = [False]

        EnumWindowsProc = ctypes.WINFUNCTYPE(
            ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM
        )

        def callback(hwnd, _lparam):
            if not user32.IsWindowVisible(hwnd):
                return True
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                if title_substring.lower() in buf.value.lower():
                    found[0] = True
                    return False
            return True

        user32.EnumWindows(EnumWindowsProc(callback), 0)
        return found[0]

    @staticmethod
    def _focus_window(title_substring: str):
        """Bring a window containing title_substring to the foreground and maximize it."""
        user32 = ctypes.windll.user32
        SW_SHOWMAXIMIZED = 3

        EnumWindowsProc = ctypes.WINFUNCTYPE(
            ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM
        )

        def callback(hwnd, _lparam):
            if not user32.IsWindowVisible(hwnd):
                return True
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                if title_substring.lower() in buf.value.lower():
                    user32.ShowWindow(hwnd, SW_SHOWMAXIMIZED)
                    user32.SetForegroundWindow(hwnd)
                    return False
            return True

        user32.EnumWindows(EnumWindowsProc(callback), 0)

    @staticmethod
    def _print_summary(result: TaskResult):
        """Print a summary of the task results."""
        summary = result.summary
        status = "PASSED" if result.passed else "FAILED"
        print(f"\n{'=' * 40}")
        print(f"RESULT: {status}")
        print(
            f"  {summary['passed']}/{summary['total']} steps passed, "
            f"{summary['failed']} failed"
        )
        print(f"{'=' * 40}")
