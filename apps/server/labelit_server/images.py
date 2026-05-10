"""Image IO and save handlers.

The server is the single source of truth for image pixels, masks, and flows.
The web client only renders metadata + a preview PNG; bulk data never leaves
this process unless an explicit save is requested.
"""

from __future__ import annotations

import base64
import io as stdio
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from cellpose import io as cp_io
from cellpose import utils as cp_utils
from PIL import Image


@dataclass
class LoadedImage:
    path: str
    array: np.ndarray
    width: int
    height: int
    channels: int
    depth: int
    dtype: str
    masks: np.ndarray | None = None
    flows: list[Any] | None = None
    meta: dict[str, Any] = field(default_factory=dict)


# Server-side cache keyed by absolute path. In single-tenant local-desktop use
# we also track which image was last opened so save handlers can find it.
_cache: dict[str, LoadedImage] = {}
_current_path: str | None = None


def _abs(path: str) -> str:
    return os.path.abspath(path)


def _shape_to_dims(arr: np.ndarray) -> tuple[int, int, int, int]:
    """Return (Z, Y, X, C) — heuristic, channel-last assumed when ambiguous."""
    if arr.ndim == 2:
        h, w = arr.shape
        return 1, int(h), int(w), 1
    if arr.ndim == 3:
        # trailing tiny axis → channels
        if arr.shape[-1] in (1, 2, 3, 4):
            h, w, c = arr.shape
            return 1, int(h), int(w), int(c)
        z, h, w = arr.shape
        return int(z), int(h), int(w), 1
    if arr.ndim == 4:
        z, h, w, c = arr.shape
        return int(z), int(h), int(w), int(c)
    raise ValueError(f"Unsupported image shape: {arr.shape}")


def _preview_png(array: np.ndarray) -> str | None:
    """Base64-encoded PNG thumbnail. Falls back to None on weird shapes."""
    try:
        arr = array
        if arr.ndim == 4:
            arr = arr[arr.shape[0] // 2]  # middle Z
        if arr.ndim == 3 and arr.shape[-1] not in (1, 2, 3, 4):
            arr = arr[arr.shape[0] // 2]  # leading Z, no channel
        if arr.ndim == 3 and arr.shape[-1] == 1:
            arr = arr[..., 0]
        if arr.ndim == 3 and arr.shape[-1] == 2:
            # pad to 3 channels for display
            pad = np.zeros((*arr.shape[:2], 1), dtype=arr.dtype)
            arr = np.concatenate([arr, pad], axis=-1)

        if arr.dtype != np.uint8:
            a = arr.astype("float32")
            lo, hi = float(a.min()), float(a.max())
            if hi > lo:
                a = (a - lo) / (hi - lo) * 255.0
            arr = a.clip(0, 255).astype("uint8")

        img = Image.fromarray(arr)
        img.thumbnail((512, 512))
        buf = stdio.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return None


def open_image(path: str) -> dict:
    """Read an image, cache it, return metadata + preview."""
    global _current_path
    abs_path = _abs(path)
    if not Path(abs_path).is_file():
        raise FileNotFoundError(f"Image not found: {abs_path}")

    arr = cp_io.imread(abs_path)
    z, h, w, c = _shape_to_dims(arr)
    loaded = LoadedImage(
        path=abs_path,
        array=arr,
        width=w,
        height=h,
        channels=c,
        depth=z,
        dtype=str(arr.dtype),
    )
    _cache[abs_path] = loaded
    _current_path = abs_path
    return {
        "path": abs_path,
        "width": w,
        "height": h,
        "channels": c,
        "depth": z,
        "dtype": loaded.dtype,
        "previewPng": _preview_png(arr),
    }


def open_masks(image_path: str, masks_path: str) -> dict:
    """Attach masks to a previously-loaded image."""
    abs_img = _abs(image_path)
    abs_masks = _abs(masks_path)
    loaded = _cache.get(abs_img)
    if loaded is None:
        raise RuntimeError(f"Load the image before its masks: {abs_img}")

    if abs_masks.endswith((".npy", ".npz")):
        data = np.load(abs_masks, allow_pickle=True)
        if isinstance(data, np.ndarray) and data.dtype == object:
            data = data.item()
        masks = data["masks"] if isinstance(data, dict) else np.asarray(data)
    else:
        masks = cp_io.imread(abs_masks)

    loaded.masks = masks
    n_rois = int(masks.max()) if masks.size else 0
    return {
        "path": abs_masks,
        "width": loaded.width,
        "height": loaded.height,
        "channels": 1,
        "depth": loaded.depth,
        "dtype": str(masks.dtype),
        "previewPng": _preview_png(masks),
        "nRois": n_rois,
    }


def get(path: str | None = None) -> LoadedImage | None:
    if path is None:
        if _current_path is None:
            return None
        return _cache.get(_current_path)
    return _cache.get(_abs(path))


def attach_run_result(image_path: str, masks: np.ndarray, flows: list[Any]) -> None:
    """Called by models.run_segmentation to keep result available for save handlers."""
    loaded = _cache.get(_abs(image_path))
    if loaded is None:
        return
    loaded.masks = masks
    loaded.flows = flows


# ---------------------------------------------------------------------------
# Save handlers — all follow cellpose's file-naming conventions.
# ---------------------------------------------------------------------------


def _require_current() -> LoadedImage:
    loaded = get()
    if loaded is None:
        raise RuntimeError("No image loaded.")
    return loaded


def _require_masks(loaded: LoadedImage) -> np.ndarray:
    if loaded.masks is None:
        raise RuntimeError("No masks present; run segmentation or load masks first.")
    return loaded.masks


def _basepath(loaded: LoadedImage, override: str | None) -> str:
    """Derive the base path the cellpose helpers will append a suffix to."""
    if override:
        # If override is a directory, place file next to it with source stem.
        p = Path(override)
        if p.is_dir():
            return str(p / Path(loaded.path).stem)
        return str(p.with_suffix(""))
    return str(Path(loaded.path).with_suffix(""))


def save_seg(target_path: str | None = None) -> dict:
    """Write `<base>_seg.npy` cellpose-compatible file."""
    loaded = _require_current()
    masks = _require_masks(loaded)
    flows = loaded.flows if loaded.flows is not None else [np.zeros_like(masks, dtype=np.uint8)] * 4
    base = _basepath(loaded, target_path)
    file_name = base + Path(loaded.path).suffix
    cp_io.masks_flows_to_seg(loaded.array, masks, flows, file_name)
    return {"path": base + "_seg.npy"}


def save_masks_png(target_path: str | None = None) -> dict:
    """Write `<base>_cp_masks.png` / .tif via cellpose.save_masks."""
    loaded = _require_current()
    masks = _require_masks(loaded)
    flows = loaded.flows if loaded.flows is not None else [np.zeros_like(masks, dtype=np.uint8)] * 4
    base = _basepath(loaded, target_path)
    file_name = base + Path(loaded.path).suffix
    cp_io.save_masks(
        loaded.array, masks, flows, file_name,
        png=True, tif=False,
    )
    return {"path": base + "_cp_masks.png"}


def save_outlines_text(target_path: str | None = None) -> dict:
    """Write `<base>_cp_outlines.txt` for ImageJ."""
    loaded = _require_current()
    masks = _require_masks(loaded)
    outlines = cp_utils.outlines_list(masks)
    base = _basepath(loaded, target_path)
    cp_io.outlines_to_text(base, outlines)
    return {"path": base + "_cp_outlines.txt"}


def save_rois_zip(target_path: str | None = None) -> dict:
    """Write `<base>_rois.zip` ImageJ ROI archive."""
    loaded = _require_current()
    masks = _require_masks(loaded)
    base = _basepath(loaded, target_path)
    file_name = base + ".tif"  # save_rois only uses splitext(file_name)[0]
    cp_io.save_rois(masks, file_name)
    return {"path": base + "_rois.zip"}


def save_flows_tif(target_path: str | None = None) -> dict:
    """Write `<base>_flows.tif` / `<base>_dP.tif` / `<base>_cp.tif`."""
    loaded = _require_current()
    if loaded.flows is None:
        raise RuntimeError("No flows available; run segmentation first.")
    base = _basepath(loaded, target_path)
    flows = loaded.flows
    # cellpose stores flows as [hsv_rgb, dP, cellprob, ...]; persist the cellprob
    # and dP arrays explicitly via tifffile-friendly imsave.
    cp_io.imsave(base + "_flows.tif", (flows[0] if len(flows) > 0 else np.zeros((1,))).astype("uint8"))
    if len(flows) > 1:
        cp_io.imsave(base + "_dP.tif", flows[1].astype("float32"))
    if len(flows) > 2:
        cp_io.imsave(base + "_cellprob.tif", flows[2].astype("float32"))
    return {"path": base + "_flows.tif"}
