"""Screenshot region comparison for visual regression testing."""

import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def compare_regions(actual: Image.Image, baseline: Image.Image,
                    threshold: float = 0.95) -> dict:
    """
    Compare two images (expected to be same-size region crops).

    Returns:
        dict with keys:
            "similar": bool — True if similarity >= threshold
            "similarity": float — 0-1 similarity score
            "diff_image": Image or None — visual diff highlighting changes
    """
    # Ensure same size
    if actual.size != baseline.size:
        actual = actual.resize(baseline.size, Image.Resampling.LANCZOS)

    actual_arr = np.array(actual.convert("RGB"), dtype=np.float32)
    baseline_arr = np.array(baseline.convert("RGB"), dtype=np.float32)

    # Mean pixel difference normalized to 0-1
    diff = np.abs(actual_arr - baseline_arr) / 255.0
    mean_diff = float(np.mean(diff))
    similarity = 1.0 - mean_diff

    # Generate diff image — highlight differences in red. Produced for both
    # passing and failing comparisons so the UI can always offer an overlay
    # view; for an exact match the image is just the actual (no red pixels).
    diff_mask = np.max(diff, axis=2) > 0.1  # pixels that differ by >10%
    diff_vis = np.array(actual.convert("RGB"))
    diff_vis[diff_mask] = [255, 0, 0]
    diff_image = Image.fromarray(diff_vis)

    return {
        "similar": similarity >= threshold,
        "similarity": round(similarity, 4),
        "diff_image": diff_image,
    }


def crop_region(screenshot: Image.Image, region: list[float]) -> Image.Image:
    """
    Crop a region from a screenshot.

    Args:
        screenshot: Full screenshot PIL image.
        region: [x1, y1, x2, y2] normalized 0-1 coordinates.

    Returns:
        Cropped PIL image.
    """
    w, h = screenshot.size
    x1 = int(region[0] * w)
    y1 = int(region[1] * h)
    x2 = int(region[2] * w)
    y2 = int(region[3] * h)
    return screenshot.crop((x1, y1, x2, y2))
