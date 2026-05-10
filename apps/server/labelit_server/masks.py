"""Server-authoritative mask editing.

The label image lives in `images.LoadedImage.masks` (uint16 / uint32). All edits
mutate that array in place, push a snapshot onto a history stack, and emit a
fresh `mask:updated` payload (with a per-label RGBA preview PNG) over the socket.

History is bounded to keep memory predictable on 4-byte-per-pixel large stacks.
"""

from __future__ import annotations

import base64
import io
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from . import images

# Bounded snapshot ring: keep N most recent states so undo doesn't blow up RAM
# on very large fields.
_HISTORY_LIMIT = 32


@dataclass
class MaskHistory:
    undo: deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=_HISTORY_LIMIT))
    redo: deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=_HISTORY_LIMIT))


# Keyed by image path so reopening an image starts a fresh history.
_history: dict[str, MaskHistory] = {}


def _hist_for(path: str) -> MaskHistory:
    h = _history.get(path)
    if h is None:
        h = MaskHistory()
        _history[path] = h
    return h


def _ensure_mask(loaded: images.LoadedImage) -> np.ndarray:
    """Return the live mask array, creating a zero array sized to the image if absent."""
    if loaded.masks is None:
        loaded.masks = np.zeros((loaded.height, loaded.width), dtype=np.uint16)
    return loaded.masks


def _push_snapshot(loaded: images.LoadedImage) -> None:
    h = _hist_for(loaded.path)
    if loaded.masks is None:
        return
    h.undo.append(loaded.masks.copy())
    h.redo.clear()


def _next_label(mask: np.ndarray) -> int:
    return int(mask.max()) + 1


def _state(loaded: images.LoadedImage) -> dict:
    mask = loaded.masks
    if mask is None:
        return {
            "width": loaded.width,
            "height": loaded.height,
            "nRois": 0,
            "previewPng": None,
            "canUndo": False,
            "canRedo": False,
        }
    h = _hist_for(loaded.path)
    n_rois = int(len(np.unique(mask)) - (1 if (mask == 0).any() else 0))
    return {
        "width": int(mask.shape[1]),
        "height": int(mask.shape[0]),
        "nRois": max(0, n_rois),
        "previewPng": _overlay_png(mask),
        "canUndo": len(h.undo) > 0,
        "canRedo": len(h.redo) > 0,
    }


# ---------------------------------------------------------------------------
# RGBA overlay preview
# ---------------------------------------------------------------------------


def _palette(n: int) -> np.ndarray:
    """Deterministic HSV-cycling palette, n+1 rows (row 0 unused = background)."""
    rng = np.random.default_rng(42)
    colors = np.zeros((n + 1, 3), dtype=np.uint8)
    if n == 0:
        return colors
    hues = np.linspace(0, 179, n, endpoint=False).astype(np.uint8)
    # rng-permute hues so adjacent labels don't share similar colors
    hues = hues[rng.permutation(n)]
    hsv = np.zeros((1, n, 3), dtype=np.uint8)
    hsv[0, :, 0] = hues
    hsv[0, :, 1] = 200
    hsv[0, :, 2] = 255
    rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)[0]
    colors[1:] = rgb
    return colors


def _overlay_png(mask: np.ndarray) -> str | None:
    n_max = int(mask.max())
    if n_max <= 0:
        # Still render a transparent canvas so the client can clear its old overlay.
        h, w = mask.shape[:2]
        img = Image.fromarray(np.zeros((h, w, 4), dtype=np.uint8), mode="RGBA")
        img.thumbnail((1024, 1024))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")
    pal = _palette(n_max)
    h, w = mask.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = pal[mask]
    rgba[..., 3] = np.where(mask > 0, 160, 0)
    img = Image.fromarray(rgba, mode="RGBA")
    img.thumbnail((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ---------------------------------------------------------------------------
# Edit operations
# ---------------------------------------------------------------------------


def stroke(points: list[dict], radius: int, erase: bool = False) -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    _push_snapshot(loaded)

    label = 0 if erase else _next_label(mask)
    pts = [(int(round(p["x"])), int(round(p["y"]))) for p in points]

    if len(pts) == 1:
        cv2.circle(mask, pts[0], radius, color=label, thickness=-1)
    else:
        for i in range(len(pts) - 1):
            cv2.line(mask, pts[i], pts[i + 1], color=label, thickness=max(1, 2 * radius))
        for p in pts:
            cv2.circle(mask, p, radius, color=label, thickness=-1)
    return _state(loaded)


def remove_at(x: int, y: int) -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    ix, iy = int(round(x)), int(round(y))
    if not (0 <= iy < mask.shape[0] and 0 <= ix < mask.shape[1]):
        return _state(loaded)
    label = int(mask[iy, ix])
    if label == 0:
        return _state(loaded)
    _push_snapshot(loaded)
    mask[mask == label] = 0
    return _state(loaded)


def clear() -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    _push_snapshot(loaded)
    mask[:] = 0
    return _state(loaded)


def undo() -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    h = _hist_for(loaded.path)
    if not h.undo:
        return _state(loaded)
    if loaded.masks is not None:
        h.redo.append(loaded.masks.copy())
    loaded.masks = h.undo.pop()
    return _state(loaded)


def redo() -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    h = _hist_for(loaded.path)
    if not h.redo:
        return _state(loaded)
    if loaded.masks is not None:
        h.undo.append(loaded.masks.copy())
    loaded.masks = h.redo.pop()
    return _state(loaded)


def current_state() -> dict:
    loaded = images.get()
    if loaded is None:
        return {
            "width": 1,
            "height": 1,
            "nRois": 0,
            "previewPng": None,
            "canUndo": False,
            "canRedo": False,
        }
    return _state(loaded)


def reset_history(path: str | None = None) -> None:
    """Clear history for a path; called on new image-open and after segmentation."""
    if path is None:
        _history.clear()
        return
    _history.pop(Path(path).as_posix() if False else path, None)
