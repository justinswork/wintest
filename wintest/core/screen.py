import pyautogui
from PIL import Image


class ScreenCapture:
    """Handles screenshot capture and coordinate space conversion."""

    def __init__(self, coordinate_scale: int = 1000):
        self.screen_width, self.screen_height = pyautogui.size()
        self.coordinate_scale = coordinate_scale

    def capture(self) -> Image.Image:
        """Take a screenshot of the primary display."""
        return pyautogui.screenshot()

    def normalized_to_pixel(
        self, x_norm: int, y_norm: int, scale: int = None
    ) -> tuple[int, int]:
        """
        Convert normalized coordinates (0-scale) to actual pixel coordinates.

        Args:
            x_norm: X coordinate on 0-{scale} scale
            y_norm: Y coordinate on 0-{scale} scale
            scale: The normalization scale (defaults to self.coordinate_scale)

        Returns:
            (pixel_x, pixel_y) tuple
        """
        scale = scale or self.coordinate_scale
        px = int(x_norm / scale * self.screen_width)
        py = int(y_norm / scale * self.screen_height)
        return (px, py)
