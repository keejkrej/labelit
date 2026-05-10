"""Filesystem browsing — drive enumeration, directory listing, home path."""

from __future__ import annotations

import os
import string
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

# Default file pattern when the explorer is opened in "image" mode.
IMAGE_EXTS = {".tif", ".tiff", ".png", ".jpg", ".jpeg", ".bmp", ".npy", ".npz"}


def detect_platform() -> Literal["windows", "darwin", "linux"]:
    if sys.platform.startswith("win"):
        return "windows"
    if sys.platform == "darwin":
        return "darwin"
    return "linux"


def list_roots() -> dict:
    """Return drive roots: C:\\, D:\\ on Windows; '/' on Unix."""
    platform = detect_platform()
    roots: list[dict] = []

    if platform == "windows":
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                roots.append({
                    "name": f"{letter}:",
                    "path": drive,
                    "kind": "drive",
                    "size": None,
                    "modifiedAt": None,
                })
    else:
        roots.append({
            "name": "/",
            "path": "/",
            "kind": "drive",
            "size": None,
            "modifiedAt": None,
        })

    return {"platform": platform, "roots": roots}


def resolve_home() -> dict:
    return {"path": str(Path.home())}


def _matches_patterns(name: str, patterns: list[str] | None) -> bool:
    if not patterns:
        return True
    ext = os.path.splitext(name)[1].lower()
    for pat in patterns:
        p = pat.lower()
        if p.startswith("*"):
            if ext == p[1:]:
                return True
        elif p == ext:
            return True
    return False


def list_dir(path: str, patterns: list[str] | None = None) -> dict:
    """List a directory: returns entries (dirs first, then files matching patterns)."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Path does not exist: {path}")
    if not p.is_dir():
        raise NotADirectoryError(f"Not a directory: {path}")

    dirs: list[dict] = []
    files: list[dict] = []

    try:
        with os.scandir(p) as it:
            for entry in it:
                # Skip hidden entries on Unix; skip system-hidden on Windows.
                if entry.name.startswith("."):
                    continue
                try:
                    stat = entry.stat(follow_symlinks=False)
                    modified = datetime.fromtimestamp(stat.st_mtime, UTC).isoformat()
                except OSError:
                    stat = None
                    modified = None

                if entry.is_dir(follow_symlinks=False):
                    dirs.append({
                        "name": entry.name,
                        "path": entry.path,
                        "kind": "dir",
                        "size": None,
                        "modifiedAt": modified,
                    })
                elif entry.is_file(follow_symlinks=False):
                    if not _matches_patterns(entry.name, patterns):
                        continue
                    files.append({
                        "name": entry.name,
                        "path": entry.path,
                        "kind": "file",
                        "size": stat.st_size if stat else None,
                        "modifiedAt": modified,
                    })
    except PermissionError as exc:
        raise PermissionError(f"Permission denied: {path}") from exc

    dirs.sort(key=lambda e: e["name"].lower())
    files.sort(key=lambda e: e["name"].lower())

    parent = str(p.parent) if p.parent != p else None
    # On Windows, a drive's parent equals itself (C:\.parent == C:\), but we want
    # to allow "up" to bounce back to the roots view — encode parent=None there.
    if detect_platform() == "windows" and p.anchor == str(p):
        parent = None

    return {
        "path": str(p),
        "parent": parent,
        "entries": dirs + files,
    }
