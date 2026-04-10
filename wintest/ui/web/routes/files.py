"""File utility routes — e.g. native file picker dialog."""

import os
import subprocess
import threading

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/pick-executable")
async def pick_executable():
    """Open a native Windows file dialog to pick an executable. Returns the path."""
    result = [None]

    def _pick():
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            path = filedialog.askopenfilename(
                title="Select Application",
                filetypes=[
                    ("Executables", "*.exe"),
                    ("All files", "*.*"),
                ],
            )
            root.destroy()
            result[0] = path if path else None
        except Exception:
            result[0] = None

    # tkinter must run on a thread (not asyncio)
    thread = threading.Thread(target=_pick)
    thread.start()
    thread.join(timeout=60)

    if result[0]:
        return {"path": result[0]}
    raise HTTPException(status_code=204, detail="No file selected")


@router.post("/pick-folder")
async def pick_folder():
    """Open a native Windows folder dialog. Returns the path."""
    result = [None]

    def _pick():
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            path = filedialog.askdirectory(title="Select Folder")
            root.destroy()
            result[0] = path if path else None
        except Exception:
            result[0] = None

    thread = threading.Thread(target=_pick)
    thread.start()
    thread.join(timeout=60)

    if result[0]:
        return {"path": result[0]}
    raise HTTPException(status_code=204, detail="No folder selected")


@router.post("/open-folder")
async def open_folder(request: dict):
    """Open a folder in the system file explorer."""
    path = request.get("path", "")
    if not path or not os.path.isdir(path):
        raise HTTPException(status_code=404, detail=f"Folder not found: {path}")
    subprocess.Popen(["explorer", os.path.normpath(path)])
    return {"status": "opened"}
