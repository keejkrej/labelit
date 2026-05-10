"""Server-authoritative mask editing.

The label image lives in `images.LoadedImage.masks` (uint16 / uint32). All edits
mutate that array in place, push a snapshot onto a history stack, and emit a
fresh `mask:updated` payload (with a per-label RGBA preview PNG + an outlines
PNG) over the socket.

History is bounded to keep memory predictable on 4-byte-per-pixel large stacks.
"""

from __future__ import annotations

import base64
import io
from collections import deque
from dataclasses import dataclass, field

import cv2
import numpy as np
from cellpose import utils as cp_utils
from PIL import Image

from . import images

# Bounded snapshot ring: keep N most recent states so undo doesn't blow up RAM
# on very large fields.
_HISTORY_LIMIT = 32


@dataclass
class MaskHistory:
    undo: deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=_HISTORY_LIMIT))
    redo: deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=_HISTORY_LIMIT))


@dataclass
class StrokeSession:
    label: int
    radius: int
    erase: bool
    last_point: tuple[int, int]
    points: list[tuple[int, int]]


_history: dict[str, MaskHistory] = {}
_active_stroke: dict[str, StrokeSession] = {}


def _hist_for(path: str) -> MaskHistory:
    h = _history.get(path)
    if h is None:
        h = MaskHistory()
        _history[path] = h
    return h


def _ensure_mask(loaded: images.LoadedImage) -> np.ndarray:
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
            "outlinesPng": None,
            "canUndo": False,
            "canRedo": False,
        }
    h = _hist_for(loaded.path)
    unique = np.unique(mask)
    n_rois = int(unique[unique > 0].size)
    return {
        "width": int(mask.shape[1]),
        "height": int(mask.shape[0]),
        "nRois": n_rois,
        "previewPng": _overlay_png(mask),
        "outlinesPng": _outlines_png(mask),
        "canUndo": len(h.undo) > 0,
        "canRedo": len(h.redo) > 0,
    }


# ---------------------------------------------------------------------------
# Preview renderers
# ---------------------------------------------------------------------------


def _palette(n: int) -> np.ndarray:
    rng = np.random.default_rng(42)
    colors = np.zeros((n + 1, 3), dtype=np.uint8)
    if n == 0:
        return colors
    hues = np.linspace(0, 179, n, endpoint=False).astype(np.uint8)
    hues = hues[rng.permutation(n)]
    hsv = np.zeros((1, n, 3), dtype=np.uint8)
    hsv[0, :, 0] = hues
    hsv[0, :, 1] = 200
    hsv[0, :, 2] = 255
    rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)[0]
    colors[1:] = rgb
    return colors


def _png_b64(rgba: np.ndarray, max_side: int = 1024) -> str:
    img = Image.fromarray(rgba, mode="RGBA")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _overlay_png(mask: np.ndarray) -> str | None:
    n_max = int(mask.max())
    h, w = mask.shape[:2]
    if n_max <= 0:
        return _png_b64(np.zeros((h, w, 4), dtype=np.uint8))
    pal = _palette(n_max)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = pal[mask]
    rgba[..., 3] = np.where(mask > 0, 160, 0)
    return _png_b64(rgba)


def _outlines_png(mask: np.ndarray) -> str | None:
    h, w = mask.shape[:2]
    if int(mask.max()) <= 0:
        return _png_b64(np.zeros((h, w, 4), dtype=np.uint8))
    outlines = cp_utils.masks_to_outlines(mask).astype(bool)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[outlines, 0] = 255
    rgba[outlines, 1] = 240
    rgba[outlines, 2] = 90
    rgba[outlines, 3] = 230
    return _png_b64(rgba)


# ---------------------------------------------------------------------------
# Single-shot strokes (used when client sends the whole path at pointer-up)
# ---------------------------------------------------------------------------


def _paint_segment(
    mask: np.ndarray,
    a: tuple[int, int],
    b: tuple[int, int],
    label: int,
    radius: int,
) -> None:
    thickness = max(1, 2 * radius)
    cv2.line(mask, a, b, color=label, thickness=thickness)
    cv2.circle(mask, b, radius, color=label, thickness=-1)


def stroke(points: list[dict], radius: int, erase: bool = False) -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    _push_snapshot(loaded)
    label = 0 if erase else _next_label(mask)
    pts = [(int(round(p["x"])), int(round(p["y"]))) for p in points]
    cv2.circle(mask, pts[0], radius, color=label, thickness=-1)
    for i in range(1, len(pts)):
        _paint_segment(mask, pts[i - 1], pts[i], label, radius)
    return _state(loaded)


# ---------------------------------------------------------------------------
# Streaming strokes
# ---------------------------------------------------------------------------


def stroke_begin(point: dict, radius: int, erase: bool = False) -> None:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    _push_snapshot(loaded)
    label = 0 if erase else _next_label(mask)
    p = (int(round(point["x"])), int(round(point["y"])))
    cv2.circle(mask, p, radius, color=label, thickness=-1)
    _active_stroke[loaded.path] = StrokeSession(
        label=label, radius=radius, erase=erase, last_point=p, points=[p]
    )


def stroke_append(points: list[dict]) -> dict | None:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    session = _active_stroke.get(loaded.path)
    if session is None:
        # No active stroke — silently treat as a single-shot stroke seeded at the first point.
        return stroke(points, radius=3, erase=False)
    mask = _ensure_mask(loaded)
    last = session.last_point
    for p in points:
        cur = (int(round(p["x"])), int(round(p["y"])))
        _paint_segment(mask, last, cur, session.label, session.radius)
        session.points.append(cur)
        last = cur
    session.last_point = last
    return None


def stroke_end() -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    session = _active_stroke.pop(loaded.path, None)
    if session is not None and len(session.points) > 2:
        mask = _ensure_mask(loaded)
        poly = np.array(session.points, dtype=np.int32)
        color = 0 if session.erase else session.label
        cv2.fillPoly(mask, [poly], color=color)
    return _state(loaded)


# ---------------------------------------------------------------------------
# Removal / merge
# ---------------------------------------------------------------------------


def _label_at(mask: np.ndarray, x: float, y: float) -> int:
    ix, iy = int(round(x)), int(round(y))
    if not (0 <= iy < mask.shape[0] and 0 <= ix < mask.shape[1]):
        return 0
    return int(mask[iy, ix])


def remove_at(x: float, y: float) -> dict:
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    label = _label_at(mask, x, y)
    if label == 0:
        return _state(loaded)
    _push_snapshot(loaded)
    mask[mask == label] = 0
    return _state(loaded)


def remove_at_points(points: list[dict]) -> dict:
    """Batch delete all ROIs under any of the given pixels in a single undo step."""
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    labels = {_label_at(mask, p["x"], p["y"]) for p in points}
    labels.discard(0)
    if not labels:
        return _state(loaded)
    _push_snapshot(loaded)
    for L in labels:
        mask[mask == L] = 0
    return _state(loaded)


def remove_in_region(polygon: list[dict]) -> dict:
    """Rasterise the polygon, find all labels touching it, zero them out."""
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    if int(mask.max()) == 0:
        return _state(loaded)
    poly = np.array(
        [[int(round(p["x"])), int(round(p["y"]))] for p in polygon],
        dtype=np.int32,
    )
    region = np.zeros(mask.shape, dtype=np.uint8)
    cv2.fillPoly(region, [poly], color=1)
    labels = np.unique(mask[region.astype(bool)])
    labels = labels[labels > 0]
    if labels.size == 0:
        return _state(loaded)
    _push_snapshot(loaded)
    for L in labels:
        mask[mask == int(L)] = 0
    return _state(loaded)


def merge_at(a: dict, b: dict) -> dict:
    """Merge the ROI containing point b into the ROI containing point a."""
    loaded = images.get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    mask = _ensure_mask(loaded)
    la = _label_at(mask, a["x"], a["y"])
    lb = _label_at(mask, b["x"], b["y"])
    if la == 0 or lb == 0 or la == lb:
        return _state(loaded)
    _push_snapshot(loaded)
    mask[mask == lb] = la
    return _state(loaded)


# ---------------------------------------------------------------------------
# Clear / undo / redo / state
# ---------------------------------------------------------------------------


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
            "outlinesPng": None,
            "canUndo": False,
            "canRedo": False,
        }
    return _state(loaded)


def reset_history(path: str | None = None) -> None:
    if path is None:
        _history.clear()
        _active_stroke.clear()
        return
    _history.pop(path, None)
    _active_stroke.pop(path, None)
