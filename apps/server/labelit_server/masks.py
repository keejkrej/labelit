"""Server-authoritative mask editing.

The label image lives in `images.LoadedImage.masks` (uint16 / uint32). All edits
mutate that array in place, push a snapshot onto a history stack, and emit a
fresh `mask:updated` payload (with a per-label RGBA preview PNG + an outlines
PNG) over the socket.

History is bounded to keep memory predictable on 4-byte-per-pixel large stacks.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

import cv2
import numpy as np
import scipy.ndimage as ndi

from . import images

# Bounded snapshot ring: keep N most recent states so undo doesn't blow up RAM
# on very large fields.
_HISTORY_LIMIT = 32


@dataclass
class MaskHistory:
    undo: deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=_HISTORY_LIMIT))
    redo: deque[np.ndarray] = field(default_factory=lambda: deque(maxlen=_HISTORY_LIMIT))


_history: dict[str, MaskHistory] = {}


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


def _extract_rois(mask: np.ndarray) -> list[dict]:
    rois = []
    # Using scipy.ndimage for fast bounding box extraction
    slices = ndi.find_objects(mask)
    for i, slc in enumerate(slices):
        if slc is None:
            continue
        label_id = i + 1
        crop = mask[slc] == label_id
        
        # cv2.findContours expects uint8
        contours, _ = cv2.findContours(
            crop.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        label_contours = []
        for c in contours:
            # c is shape (N, 1, 2). Shift back by the slice offsets.
            c = c + [slc[1].start, slc[0].start]
            
            # Downsample to save network payload
            c = cv2.approxPolyDP(c, epsilon=1.0, closed=True)
            
            pts = c.reshape(-1, 2).tolist()
            if len(pts) >= 3:
                label_contours.append(pts)
                
        if label_contours:
            rois.append({"id": label_id, "contours": label_contours})
            
    return rois


def _state(loaded: images.LoadedImage) -> dict:
    mask = loaded.masks
    h = _hist_for(loaded.path)
    if mask is None:
        return {
            "width": loaded.width,
            "height": loaded.height,
            "nRois": 0,
            "rois": [],
            "canUndo": False,
            "canRedo": False,
        }
    unique = np.unique(mask)
    n_rois = int(unique[unique > 0].size)
    return {
        "width": int(mask.shape[1]),
        "height": int(mask.shape[0]),
        "nRois": n_rois,
        "rois": _extract_rois(mask),
        "canUndo": len(h.undo) > 0,
        "canRedo": len(h.redo) > 0,
    }


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
    pts = [(round(p["x"]), round(p["y"])) for p in points]
    cv2.circle(mask, pts[0], radius, color=label, thickness=-1)
    for i in range(1, len(pts)):
        _paint_segment(mask, pts[i - 1], pts[i], label, radius)
    return _state(loaded)


# ---------------------------------------------------------------------------
# Removal / merge
# ---------------------------------------------------------------------------


def _label_at(mask: np.ndarray, x: float, y: float) -> int:
    ix, iy = round(x), round(y)
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
        [[round(p["x"]), round(p["y"])] for p in polygon],
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


def replace_current_mask(mask: np.ndarray, path: str | None = None, push_history: bool = True) -> dict:
    loaded = images.get(path)
    if loaded is None:
        raise RuntimeError("No image loaded.")
    if push_history and loaded.masks is not None:
        _push_snapshot(loaded)
    loaded.masks = mask
    if path is not None:
        images.set_current(path)
    return _state(loaded)


def reset_history(path: str | None = None) -> None:
    if path is None:
        _history.clear()
        return
    _history.pop(path, None)
