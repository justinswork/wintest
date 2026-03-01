import ctypes
import ctypes.wintypes
import logging
import os
import subprocess
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

WM_CLOSE = 0x0010
SW_RESTORE = 9
SW_SHOWMAXIMIZED = 3


@dataclass
class AppConfig:
    """Application configuration, parsed from task YAML."""

    path: str
    title: Optional[str] = None
    wait_after_launch: float = 3.0
    process_name: Optional[str] = None

    def __post_init__(self):
        if self.process_name is None:
            self.process_name = self.path.replace("\\", "/").split("/")[-1]


def _get_window_process_id(user32, hwnd) -> int:
    """Get the process ID that owns the given window handle."""
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value


class ApplicationManager:
    """
    Manages the lifecycle of a desktop application under test.

    Handles launch, focus, running checks, graceful close, and force kill.
    Uses ctypes for all Win32 window operations.

    SAFETY: All window operations are scoped to the process that was launched.
    This prevents accidentally closing or interacting with other windows
    (e.g. VS Code, other editors) that happen to have a matching title.
    """

    def __init__(
        self,
        config: AppConfig,
        graceful_close_timeout: float = 5.0,
        focus_delay: float = 0.3,
    ):
        self.config = config
        self.graceful_close_timeout = graceful_close_timeout
        self.focus_delay = focus_delay
        self._process: Optional[subprocess.Popen] = None
        self._user32 = ctypes.windll.user32

    @property
    def _pid(self) -> Optional[int]:
        """The PID of the launched process, if available."""
        return self._process.pid if self._process else None

    def launch(self, kill_existing: bool = True) -> None:
        """Launch the application. Optionally kill existing instances first."""
        if kill_existing and self.config.title and self.find_window_handle():
            logger.info("Closing existing '%s' windows...", self.config.title)
            self._close_matching_windows()
            time.sleep(1)

        logger.info("Launching: %s", self.config.path)
        self._process = subprocess.Popen(self.config.path, shell=True)
        logger.info(
            "Waiting %.1fs for application to start (PID %d)...",
            self.config.wait_after_launch,
            self._process.pid,
        )
        time.sleep(self.config.wait_after_launch)

    def focus(self) -> bool:
        """Bring the application window to the foreground and maximize it."""
        if not self.config.title:
            return False

        hwnd = self.find_window_handle()
        if hwnd:
            self._user32.ShowWindow(hwnd, SW_RESTORE)
            self._user32.ShowWindow(hwnd, SW_SHOWMAXIMIZED)
            self._user32.SetForegroundWindow(hwnd)
            time.sleep(self.focus_delay)
            return True

        logger.warning(
            "Could not find window matching '%s' to focus", self.config.title
        )
        return False

    def is_running(self) -> bool:
        """Check if the application process is still running."""
        if self._process is not None:
            return self._process.poll() is None
        if self.config.title:
            return self.find_window_handle() is not None
        return False

    def close(self) -> None:
        """Close gracefully (WM_CLOSE), falling back to force kill on timeout.

        Only targets windows owned by the launched process to avoid closing
        unrelated applications.
        """
        hwnd = self.find_window_handle() if self.config.title else None
        if hwnd:
            logger.info("Sending WM_CLOSE to '%s' (PID %s)...", self.config.title, self._pid)
            self._user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)

            deadline = time.time() + self.graceful_close_timeout
            while time.time() < deadline:
                if not self.find_window_handle():
                    logger.info("Application closed gracefully.")
                    return
                time.sleep(0.5)

            logger.warning("Graceful close timed out, force-killing...")

        self.force_close()

    def force_close(self) -> None:
        """Force-kill the launched process by PID, or fall back to process name.

        When a PID is available (the normal case), only that specific process
        is killed. The process-name fallback only runs before launch when
        cleaning up pre-existing windows.
        """
        if self._process is not None:
            pid = self._process.pid
            logger.info("Force-closing PID %d (%s)", pid, self.config.process_name)
            os.system(f"taskkill /PID {pid} /T /F >nul 2>&1")
        else:
            logger.info("Force-closing by name: %s", self.config.process_name)
            os.system(f"taskkill /IM {self.config.process_name} /F >nul 2>&1")

    def find_window_handle(self) -> Optional[int]:
        """Find the HWND of the first visible window matching the title.

        When a launched process PID is available, only windows belonging to
        that process are considered. This prevents matching unrelated windows
        (e.g. an editor with 'notepad' in the tab title).
        """
        if not self.config.title:
            return None

        result = [None]
        title_lower = self.config.title.lower()
        target_pid = self._pid

        @ctypes.WINFUNCTYPE(
            ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM
        )
        def callback(hwnd, _lparam):
            if not self._user32.IsWindowVisible(hwnd):
                return True
            # If we have a PID, only consider windows from that process
            if target_pid is not None:
                window_pid = _get_window_process_id(self._user32, hwnd)
                if window_pid != target_pid:
                    return True
            length = self._user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                self._user32.GetWindowTextW(hwnd, buf, length + 1)
                if title_lower in buf.value.lower():
                    result[0] = hwnd
                    return False
            return True

        self._user32.EnumWindows(callback, 0)
        return result[0]

    def get_foreground_window_title(self) -> Optional[str]:
        """Return the title of the current foreground window."""
        hwnd = self._user32.GetForegroundWindow()
        if not hwnd:
            return None
        length = self._user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return None
        buf = ctypes.create_unicode_buffer(length + 1)
        self._user32.GetWindowTextW(hwnd, buf, length + 1)
        return buf.value

    def _close_matching_windows(self) -> None:
        """Close all visible windows matching the title (used before launch).

        This is only called before launch to clean up pre-existing instances,
        so it does NOT filter by PID.
        """
        logger.info("Force-closing by name: %s", self.config.process_name)
        os.system(f"taskkill /IM {self.config.process_name} /F >nul 2>&1")
