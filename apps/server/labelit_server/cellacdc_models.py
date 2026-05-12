"""Cell-ACDC model, tracking, and lightweight annotation support."""

from __future__ import annotations

import asyncio
import importlib
import json
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import numpy as np
import skimage.filters
from skimage.measure import label as sk_label
from skimage.measure import regionprops

from . import images, masks

AnnotationMap = dict[str, dict[str, Any]]

_annotations: dict[tuple[str, int], AnnotationMap] = {}


def _module_name(model_name: str) -> str:
    if model_name == "Automatic thresholding":
        return "thresholding"
    return model_name


def _import_segment_module(model_name: str):
    module_name = _module_name(model_name)
    return importlib.import_module(f"cellacdc.models.{module_name}.acdcSegment")


def _fallback_model_names() -> list[str]:
    repo_root = Path(__file__).resolve().parents[3]
    models_dir = repo_root / "cellacdc" / "src" / "cellacdc" / "models"
    if not models_dir.is_dir():
        return ["Automatic thresholding", "cellpose_v4"]

    names = []
    for child in models_dir.iterdir():
        if (
            child.is_dir()
            and not child.name.startswith("_")
            and not child.name.endswith("__")
            and child.name != "skip_segmentation"
            and (child / "acdcSegment.py").is_file()
        ):
            names.append("Automatic thresholding" if child.name == "thresholding" else child.name)
    return sorted(set(names), key=str.casefold)


def list_models() -> list[dict[str, Any]]:
    try:
        from cellacdc import myutils

        names = list(myutils.get_list_of_models())
    except Exception as exc:
        names = _fallback_model_names()
        cellacdc_import_error = str(exc)
    else:
        cellacdc_import_error = ""

    result = []
    for name in names:
        if name == "Automatic thresholding":
            importable = True
            reason = ""
        elif name == "cellpose_v4":
            try:
                from cellpose import models as _cp_models  # noqa: F401

                importable = True
                reason = ""
            except Exception as exc:
                importable = False
                reason = str(exc)
        else:
            try:
                _import_segment_module(name)
                importable = True
                reason = ""
            except Exception as exc:
                importable = False
                reason = str(exc) or cellacdc_import_error

        default_runnable = name in {"Automatic thresholding", "cellpose_v4"}
        result.append(
            {
                "name": name,
                "source": "builtin",
                "available": bool(importable and default_runnable),
                "unsupportedReason": None
                if importable and default_runnable
                else (
                    reason
                    if not importable
                    else "Requires Cell-ACDC parameter dialog values; provide initParams/segmentParams."
                ),
            }
        )
    return result


def _common_segment_params(payload: dict[str, Any]) -> dict[str, Any]:
    segmentation = payload.get("segmentation")
    source = dict(segmentation) if isinstance(segmentation, dict) else dict(payload)
    params: dict[str, Any] = {}

    if source.get("diameter") is not None:
        params["diameter"] = float(source["diameter"])
    if source.get("flowThreshold") is not None:
        params["flow_threshold"] = float(source["flowThreshold"])
    if source.get("cellprobThreshold") is not None:
        params["cellprob_threshold"] = float(source["cellprobThreshold"])
    if source.get("niter") is not None:
        params["niter"] = int(source["niter"])
    if source.get("minSize") is not None:
        params["min_size"] = int(source["minSize"])
    if source.get("anisotropy") is not None:
        params["anisotropy"] = float(source["anisotropy"])
    return params


def _run_thresholding(image: np.ndarray, params: dict[str, Any]) -> np.ndarray:
    gauss_sigma = float(params.get("gauss_sigma", 1.0))
    threshold_method = str(params.get("threshold_method", "threshold_otsu"))
    segment_3d = bool(params.get("segment_3D_volume", False))

    def _segment_plane(plane: np.ndarray) -> np.ndarray:
        filtered = skimage.filters.gaussian(plane, sigma=gauss_sigma) if gauss_sigma > 0 else plane
        threshold_fn = getattr(skimage.filters, threshold_method)
        return filtered > threshold_fn(filtered)

    if image.ndim > 2 and not segment_3d:
        labels = np.zeros(image.shape, dtype=np.uint32)
        for z, plane in enumerate(image):
            labels[z] = sk_label(_segment_plane(plane))
        return labels

    return sk_label(_segment_plane(image)).astype(np.uint32)


def _run_cellpose_v4_fallback(
    image: np.ndarray,
    init_params: dict[str, Any],
    segment_params: dict[str, Any],
    use_gpu: bool,
) -> np.ndarray:
    from cellpose import models as cp_models

    model_name = init_params.get("model_type") or init_params.get("model_path") or "cpsam"
    model = cp_models.CellposeModel(gpu=use_gpu, pretrained_model=model_name)
    masks_result, _flows, _styles = model.eval(
        image,
        diameter=segment_params.get("diameter"),
        flow_threshold=float(segment_params.get("flow_threshold", 0.4)),
        cellprob_threshold=float(segment_params.get("cellprob_threshold", 0.0)),
        min_size=int(segment_params.get("min_size", 15)),
        niter=segment_params.get("niter") or None,
        anisotropy=segment_params.get("anisotropy"),
    )
    return np.asarray(masks_result)


async def run_segmentation(
    payload: dict[str, Any],
    emit: Callable[[dict[str, Any]], Awaitable[None]],
) -> dict[str, Any]:
    image_path = payload["imagePath"]
    loaded = images.get(image_path)
    if loaded is None:
        raise RuntimeError(f"Image not loaded: {image_path}. Send `image:open` first.")

    model_name = payload.get("model") or "Automatic thresholding"
    init_params = dict(payload.get("initParams") or {})
    segment_params = dict(payload.get("segmentParams") or {})
    segment_params.update(_common_segment_params(payload))

    await emit({"job": "run", "progress": 0.0, "message": f"loading {model_name}"})

    def _do_run() -> np.ndarray:
        if model_name == "Automatic thresholding":
            return _run_thresholding(loaded.array, segment_params)

        if model_name == "cellpose_v4":
            try:
                module = _import_segment_module(model_name)
                model_cls = module.Model
                init_params.setdefault("device_type", "gpu" if payload.get("useGpu", True) else "cpu")
                init_params.setdefault("model_type", "cpsam")
                model = model_cls(**init_params)
                if hasattr(model, "init_successful") and not model.init_successful:
                    raise RuntimeError("Cell-ACDC cellpose_v4 model initialization did not complete.")
                segment_params.setdefault("diameter", 0.0)
                segment_params.setdefault("flow_threshold", 0.4)
                segment_params.setdefault("cellprob_threshold", 0.0)
                segment_params.setdefault("min_size", 15)
                segment_params.setdefault("anisotropy", 0.0)
                return np.asarray(model.segment(loaded.array, **segment_params))
            except Exception:
                return _run_cellpose_v4_fallback(
                    loaded.array,
                    init_params,
                    segment_params,
                    bool(payload.get("useGpu", True)),
                )

        if not init_params and not segment_params:
            raise RuntimeError(
                f"{model_name} requires Cell-ACDC parameter dialog values. "
                "Provide initParams and/or segmentParams."
            )

        module = _import_segment_module(model_name)
        model_cls = module.Model
        model = model_cls(**init_params)
        return np.asarray(model.segment(loaded.array, **segment_params))

    result_mask = await asyncio.to_thread(_do_run)
    images.attach_run_result(image_path, result_mask, None)
    masks.reset_history(image_path)

    seg_path: str | None = None
    try:
        seg_path = images.save_seg(None)["path"]
    except Exception:
        seg_path = None

    n_rois = int(np.unique(result_mask[result_mask > 0]).size) if result_mask.size else 0
    await emit({"job": "run", "progress": 1.0, "message": "done"})
    return {"imagePath": image_path, "nRois": n_rois, "segPath": seg_path}


def _annotation_sidecar(path: str) -> Path:
    p = Path(path)
    return p.with_name(f"{p.stem}_cellacdc_annotations.json")


def _annotation_key(path: str | None, frame: int | None) -> tuple[str, int]:
    loaded = images.get(path)
    if loaded is None:
        raise RuntimeError("No image loaded.")
    return loaded.path, int(frame or 0)


def _load_annotations(path: str, frame: int) -> AnnotationMap:
    key = (path, frame)
    if key in _annotations:
        return _annotations[key]

    sidecar = _annotation_sidecar(path)
    data: AnnotationMap = {}
    if sidecar.is_file():
        try:
            raw = json.loads(sidecar.read_text(encoding="utf-8"))
            frame_data = raw.get("frames", {}).get(str(frame), {})
            if isinstance(frame_data, dict):
                data = frame_data
        except Exception:
            data = {}
    _annotations[key] = data
    return data


def _save_annotations(path: str) -> None:
    sidecar = _annotation_sidecar(path)
    frames = {
        str(frame): ann
        for (ann_path, frame), ann in _annotations.items()
        if ann_path == path and ann
    }
    sidecar.write_text(
        json.dumps({"version": 1, "imagePath": path, "frames": frames}, indent=2),
        encoding="utf-8",
    )


def _annotations_payload(path: str, frame: int) -> dict[str, Any]:
    return {
        "imagePath": path,
        "frame": frame,
        "annotations": _load_annotations(path, frame),
    }


def set_annotation(payload: dict[str, Any]) -> dict[str, Any]:
    path, frame = _annotation_key(payload.get("imagePath"), payload.get("frame"))
    annotations = _load_annotations(path, frame)
    object_key = str(int(payload["objectId"]))
    item = dict(annotations.get(object_key) or {})
    kind = payload["annotation"]

    if kind == "motherBudLink":
        target = payload.get("targetObjectId")
        if target is None or payload.get("value") is False:
            item.pop("motherBudTarget", None)
        else:
            item["motherBudTarget"] = int(target)
    else:
        item[kind] = bool(payload.get("value", True))

    item = {k: v for k, v in item.items() if v not in (False, None)}
    if item:
        annotations[object_key] = item
    else:
        annotations.pop(object_key, None)
    _save_annotations(path)
    return _annotations_payload(path, frame)


def clear_annotation(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    path, frame = _annotation_key(payload.get("imagePath"), payload.get("frame"))
    annotations = _load_annotations(path, frame)
    object_id = payload.get("objectId")
    kind = payload.get("annotation")

    if object_id is None:
        annotations.clear()
    else:
        object_key = str(int(object_id))
        if kind is None:
            annotations.pop(object_key, None)
        else:
            item = dict(annotations.get(object_key) or {})
            item.pop("motherBudTarget" if kind == "motherBudLink" else kind, None)
            if item:
                annotations[object_key] = item
            else:
                annotations.pop(object_key, None)

    _save_annotations(path)
    return _annotations_payload(path, frame)


def current_annotations(path: str | None = None, frame: int | None = None) -> dict[str, Any]:
    resolved_path, resolved_frame = _annotation_key(path, frame)
    return _annotations_payload(resolved_path, resolved_frame)


def _loaded_with_masks() -> list[images.LoadedImage]:
    return sorted(
        [loaded for loaded in images.iter_loaded() if loaded.masks is not None],
        key=lambda item: os.path.normcase(item.path),
    )


def _track_pair(prev_mask: np.ndarray, current_mask: np.ndarray, threshold: float) -> np.ndarray:
    from cellacdc.trackers.CellACDC.CellACDC_tracker import track_frame

    return np.asarray(
        track_frame(
            prev_mask,
            regionprops(prev_mask),
            current_mask,
            regionprops(current_mask.copy()),
            IoA_thresh=threshold,
        )
    )


def track_current_frame(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    loaded = images.get(payload.get("imagePath"))
    if loaded is None:
        raise RuntimeError("No image loaded.")
    if loaded.masks is None:
        raise RuntimeError("Current image has no masks to track.")

    loaded_items = _loaded_with_masks()
    paths = [item.path for item in loaded_items]
    try:
        idx = paths.index(loaded.path)
    except ValueError as exc:
        raise RuntimeError("Current image is not present in the loaded mask cache.") from exc
    if idx == 0:
        raise RuntimeError("No previously loaded mask frame is available for tracking.")

    threshold = float(payload.get("IoAThreshold", 0.4))
    tracked = _track_pair(loaded_items[idx - 1].masks, loaded.masks, threshold)
    return masks.replace_current_mask(tracked, loaded.path)


def track_loaded_series(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    current = images.get(payload.get("imagePath"))
    if current is None:
        raise RuntimeError("No image loaded.")

    loaded_items = _loaded_with_masks()
    if len(loaded_items) < 2:
        raise RuntimeError("Load at least two series frames with masks before series tracking.")

    threshold = float(payload.get("IoAThreshold", 0.4))
    previous = loaded_items[0].masks
    for loaded in loaded_items[1:]:
        tracked = _track_pair(previous, loaded.masks, threshold)
        loaded.masks = tracked
        previous = tracked

    return masks.replace_current_mask(current.masks, current.path, push_history=False)
