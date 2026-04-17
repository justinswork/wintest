"""Windows Startup-folder registration for the wintest scheduler."""

import os
import shutil
import sys
from pathlib import Path

STARTUP_FILENAME = "wintest-scheduler.vbs"


def _startup_folder() -> Path:
    """Return the per-user Startup folder path."""
    appdata = os.environ.get("APPDATA")
    if not appdata:
        raise RuntimeError("APPDATA environment variable not set")
    return Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"


def _startup_file() -> Path:
    return _startup_folder() / STARTUP_FILENAME


def _resolve_wintest_command() -> str:
    """Build the command line that launches `wintest scheduler`.

    Prefers the installed `wintest` console script on PATH; falls back to
    `<python> -m wintest scheduler` using the current interpreter.
    """
    wintest_bin = shutil.which("wintest")
    if wintest_bin:
        return f'"{wintest_bin}" scheduler'
    # Fallback: run the module with pythonw (no console window)
    python_dir = Path(sys.executable).parent
    pythonw = python_dir / "pythonw.exe"
    interp = str(pythonw if pythonw.exists() else sys.executable)
    return f'"{interp}" -m wintest scheduler'


def install_startup() -> Path:
    """Create a .vbs launcher in the Startup folder. Returns the file path."""
    folder = _startup_folder()
    folder.mkdir(parents=True, exist_ok=True)
    cmd = _resolve_wintest_command()
    # WScript.Shell.Run with 0 == hidden window, False == don't wait
    vbs_content = (
        'Set WshShell = CreateObject("WScript.Shell")\r\n'
        f'WshShell.Run "{cmd}", 0, False\r\n'
    )
    path = _startup_file()
    path.write_text(vbs_content, encoding="utf-8")
    return path


def uninstall_startup() -> bool:
    """Remove the Startup-folder launcher. Returns True if a file was removed."""
    path = _startup_file()
    if path.exists():
        path.unlink()
        return True
    return False


def is_startup_installed() -> bool:
    return _startup_file().exists()
