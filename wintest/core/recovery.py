import logging
import time

from .app_manager import ApplicationManager
from .actions import ActionExecutor

logger = logging.getLogger(__name__)


class RecoveryStrategy:
    """
    Attempts to recover from step failures before giving up.

    Recovery sequence:
      1. Check if target app is already focused (no-op)
      2. Dismiss unexpected dialog by pressing Escape
      3. Re-focus target application window
      4. Verify app is still running
    """

    def __init__(
        self,
        app_manager: ApplicationManager,
        actions: ActionExecutor,
        max_attempts: int = 2,
        dismiss_keys: list[str] = None,
        recovery_delay: float = 1.0,
    ):
        self.app_manager = app_manager
        self.actions = actions
        self.max_attempts = max_attempts
        self.dismiss_keys = dismiss_keys or ["escape"]
        self.recovery_delay = recovery_delay

    def attempt_recovery(self) -> bool:
        """
        Try to recover the test environment.

        Returns True if the target app is back in the foreground.
        """
        for attempt in range(1, self.max_attempts + 1):
            logger.warning(
                "Recovery attempt %d/%d", attempt, self.max_attempts
            )

            if self._is_target_focused():
                logger.info("Target app already focused, no recovery needed.")
                return True

            # Try dismissing any unexpected dialog
            self._dismiss_dialog()
            time.sleep(0.3)
            if self._is_target_focused():
                logger.info("Recovery succeeded: dialog dismissed.")
                return True

            # Try re-focusing the target app
            if self.app_manager.focus():
                time.sleep(self.recovery_delay)
                if self._is_target_focused():
                    logger.info("Recovery succeeded: app re-focused.")
                    return True

            # Check if app is still alive
            if not self.app_manager.is_running():
                logger.error(
                    "Target application is no longer running. Cannot recover."
                )
                return False

            time.sleep(self.recovery_delay)

        logger.error("All %d recovery attempts exhausted.", self.max_attempts)
        return False

    def _is_target_focused(self) -> bool:
        """Check if the target application is in the foreground."""
        title = self.app_manager.config.title
        if not title:
            return True
        fg_title = self.app_manager.get_foreground_window_title()
        if fg_title is None:
            return False
        return title.lower() in fg_title.lower()

    def _dismiss_dialog(self) -> bool:
        """Press dismiss keys if an unexpected window is in the foreground."""
        fg_title = self.app_manager.get_foreground_window_title() or ""
        target_title = (self.app_manager.config.title or "").lower()

        if target_title and target_title in fg_title.lower():
            return False

        logger.info(
            "Unexpected foreground window: '%s'. Pressing %s to dismiss.",
            fg_title,
            self.dismiss_keys,
        )
        for key in self.dismiss_keys:
            self.actions.press_key(key)
            time.sleep(0.3)
        return True
