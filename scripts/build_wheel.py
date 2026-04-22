#!/usr/bin/env python
"""Build a wintest wheel + sdist with the frontend baked in.

Runs the Vite build first so wintest/ui/web/frontend/dist/ exists, then invokes
python -m build. Without this, the wheel ships without the SPA and `wintest web`
falls back to the API-only hint message.

Usage:
    python scripts/build_wheel.py
    python scripts/build_wheel.py --skip-npm-ci   # reuse existing node_modules
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "wintest" / "ui" / "web" / "frontend"
DIST = ROOT / "dist"


def run(cmd, cwd):
    print(f"\n>>> {' '.join(cmd)}  (cwd={cwd})", flush=True)
    subprocess.run(cmd, cwd=cwd, check=True, shell=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--skip-npm-ci", action="store_true",
                        help="Skip `npm ci` (reuse existing node_modules).")
    args = parser.parse_args()

    npm = shutil.which("npm")
    if not npm:
        sys.exit("npm not found on PATH — install Node.js first.")

    if DIST.exists():
        shutil.rmtree(DIST)

    if not args.skip_npm_ci:
        run([npm, "ci"], cwd=FRONTEND)
    run([npm, "run", "build"], cwd=FRONTEND)

    if not (FRONTEND / "dist" / "index.html").exists():
        sys.exit("Frontend build did not produce dist/index.html — aborting.")

    run([sys.executable, "-m", "build"], cwd=ROOT)

    print("\nBuilt artifacts:")
    for p in sorted(DIST.iterdir()):
        print(f"  {p.name}")


if __name__ == "__main__":
    main()
