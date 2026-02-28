import time
import pyautogui


class ActionExecutor:
    """Executes desktop UI actions (click, type, keypress, etc.)."""

    def __init__(self, action_settings=None):
        """
        Args:
            action_settings: ActionSettings dataclass, or None for defaults.
        """
        if action_settings is None:
            from ..config.settings import ActionSettings
            action_settings = ActionSettings()
        self.settings = action_settings
        pyautogui.FAILSAFE = action_settings.failsafe
        pyautogui.PAUSE = action_settings.action_delay

    def click(self, x: int, y: int, button: str = "left", clicks: int = 1):
        """Click at pixel coordinates."""
        pyautogui.click(x, y, button=button, clicks=clicks)

    def type_text(self, text: str, interval: float = None):
        """Type text character by character."""
        interval = interval if interval is not None else self.settings.type_interval
        pyautogui.typewrite(text, interval=interval)

    def press_key(self, key: str):
        """Press a single keyboard key (e.g., 'enter', 'tab', 'delete')."""
        pyautogui.press(key)

    def hotkey(self, *keys: str):
        """Press a key combination (e.g., hotkey('ctrl', 'c'))."""
        pyautogui.hotkey(*keys)

    def scroll(self, clicks: int, x: int = None, y: int = None):
        """Scroll the mouse wheel. Positive = up, negative = down."""
        pyautogui.scroll(clicks, x, y)

    def wait(self, seconds: float):
        """Wait for a duration before the next action."""
        time.sleep(seconds)
