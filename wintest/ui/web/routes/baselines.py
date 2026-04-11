"""Baseline image API routes for screenshot comparison."""

import base64
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ....config import workspace

router = APIRouter()


class SaveBaselineRequest(BaseModel):
    image_base64: str  # base64-encoded PNG of the cropped region
    name: str = ""     # optional human-readable name


class SaveFileBaselineRequest(BaseModel):
    source_path: str   # path to file on disk to copy as baseline
    name: str = ""     # optional human-readable name


@router.post("")
async def save_baseline(request: SaveBaselineRequest):
    """Save a baseline image. Returns the baseline_id."""
    baseline_id = request.name or str(uuid.uuid4())[:8]
    # Sanitize
    baseline_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in baseline_id)

    baselines = workspace.baselines_dir()
    path = baselines / f"{baseline_id}.png"

    # Avoid overwriting — append number if needed
    counter = 1
    original_id = baseline_id
    while path.exists():
        baseline_id = f"{original_id}_{counter}"
        path = baselines / f"{baseline_id}.png"
        counter += 1

    try:
        img_data = base64.b64decode(request.image_base64)
        with open(path, "wb") as f:
            f.write(img_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save baseline: {e}")

    return {"baseline_id": baseline_id, "path": str(path)}


@router.post("/from-file")
async def save_file_baseline(request: SaveFileBaselineRequest):
    """Copy a file from disk as a baseline."""
    import shutil
    from pathlib import Path

    source = Path(request.source_path)
    if not source.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {request.source_path}")

    baseline_id = request.name or source.stem
    baseline_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in baseline_id)

    baselines = workspace.baselines_dir()
    ext = source.suffix
    dest = baselines / f"{baseline_id}{ext}"

    counter = 1
    original_id = baseline_id
    while dest.exists():
        baseline_id = f"{original_id}_{counter}"
        dest = baselines / f"{baseline_id}{ext}"
        counter += 1

    try:
        shutil.copy2(str(source), str(dest))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to copy file: {e}")

    return {"baseline_id": f"{baseline_id}{ext}", "path": str(dest)}


@router.get("")
async def list_baselines():
    """List all saved baselines."""
    baselines = workspace.baselines_dir()
    if not baselines.exists():
        return []
    return [
        {"baseline_id": p.stem, "filename": p.name}
        for p in sorted(baselines.glob("*.png"))
    ]


@router.get("/{baseline_id}")
async def get_baseline(baseline_id: str):
    """Get a baseline image as base64."""
    path = workspace.baselines_dir() / f"{baseline_id}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Baseline not found: {baseline_id}")

    img_data = path.read_bytes()
    return {
        "baseline_id": baseline_id,
        "image_base64": base64.b64encode(img_data).decode(),
    }


@router.delete("/{baseline_id}")
async def delete_baseline(baseline_id: str):
    """Delete a baseline image."""
    path = workspace.baselines_dir() / f"{baseline_id}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Baseline not found: {baseline_id}")
    path.unlink()
    return {"deleted": baseline_id}
