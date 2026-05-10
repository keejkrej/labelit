"""Cellpose inference + training, bridged to the websocket via asyncio queues.

Both jobs run in a worker thread (`asyncio.to_thread`) so the event loop stays
responsive. Progress is pushed onto an `asyncio.Queue` from the worker — either
via a duck-typed QProgressBar (inference) or a `logging.Handler` that scrapes
epoch lines (training) — and drained by the calling coroutine.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import numpy as np

from cellpose import models as cp_models
from cellpose import train as cp_train
from cellpose import io as cp_io

from . import images

# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------


def list_models() -> list[dict]:
    builtin = list(cp_models.MODEL_NAMES) or ["cpsam"]
    try:
        custom = list(cp_models.get_user_models() or [])
    except Exception:
        custom = []
    return [{"name": n, "source": "builtin"} for n in builtin] + [
        {"name": n, "source": "custom"} for n in custom
    ]


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------


class _QueueProgressBar:
    """Duck-typed QProgressBar shim. Cellpose calls .setValue(int 0-100)."""

    def __init__(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue) -> None:
        self._loop = loop
        self._queue = queue

    def setValue(self, v: int) -> None:  # noqa: N802 — Qt naming required
        item = {"job": "run", "progress": max(0.0, min(1.0, v / 100.0)), "message": ""}
        self._loop.call_soon_threadsafe(self._queue.put_nowait, item)


async def run_segmentation(
    payload: dict,
    emit: Callable[[dict], Awaitable[None]],
) -> dict:
    """Run cellpose segmentation on the currently-cached image."""
    image_path = payload["imagePath"]
    loaded = images.get(image_path)
    if loaded is None:
        raise RuntimeError(f"Image not loaded: {image_path}. Send `image:open` first.")

    model_name = payload.get("model") or "cpsam"
    use_gpu = bool(payload.get("useGpu", True))
    diameter = payload.get("diameter")
    flow_thresh = float(payload.get("flowThreshold", 0.4))
    cellprob_thresh = float(payload.get("cellprobThreshold", 0.0))
    min_size = int(payload.get("minSize", 15))
    niter = payload.get("niter") or None
    anisotropy = payload.get("anisotropy")

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    await emit({"job": "run", "progress": 0.0, "message": f"loading model {model_name}"})

    def _do_run() -> tuple[np.ndarray, list[Any]]:
        progress = _QueueProgressBar(loop, queue)
        model = cp_models.CellposeModel(gpu=use_gpu, pretrained_model=model_name)
        masks, flows, _styles = model.eval(
            loaded.array,
            diameter=diameter,
            flow_threshold=flow_thresh,
            cellprob_threshold=cellprob_thresh,
            min_size=min_size,
            niter=niter,
            anisotropy=anisotropy,
            progress=progress,
        )
        return masks, flows

    drain_task = asyncio.create_task(_drain(queue, emit))
    try:
        masks, flows = await asyncio.to_thread(_do_run)
    finally:
        await queue.put(None)
        await drain_task

    images.attach_run_result(image_path, masks, flows)
    n_rois = int(masks.max()) if masks is not None and masks.size else 0

    # Autosave _seg.npy to match cellpose-gui behavior.
    seg_path: str | None = None
    try:
        base = str(Path(image_path).with_suffix(""))
        file_name = base + Path(image_path).suffix
        cp_io.masks_flows_to_seg(loaded.array, masks, flows, file_name)
        seg_path = base + "_seg.npy"
    except Exception:
        seg_path = None

    await emit({"job": "run", "progress": 1.0, "message": "done"})
    return {"imagePath": image_path, "nRois": n_rois, "segPath": seg_path}


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

# Lines like: "5, train_loss=0.1234, test_loss=0.5678, LR=0.000010, time 12.34s"
_EPOCH_RE = re.compile(r"^(\d+),\s*train_loss=(\S+?),\s*test_loss=(\S+?),")


class _QueueLogHandler(logging.Handler):
    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        queue: asyncio.Queue,
        n_epochs: int,
    ) -> None:
        super().__init__()
        self._loop = loop
        self._queue = queue
        self._n_epochs = max(1, n_epochs)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = record.getMessage()
        except Exception:
            return
        m = _EPOCH_RE.match(msg)
        if not m:
            return
        epoch = int(m.group(1))
        progress = min(1.0, (epoch + 1) / self._n_epochs)
        item = {"job": "train", "progress": progress, "message": msg}
        self._loop.call_soon_threadsafe(self._queue.put_nowait, item)


async def train_model(
    payload: dict,
    emit: Callable[[dict], Awaitable[None]],
) -> dict:
    """Train a cellpose model on a directory of images+masks."""
    train_dir = payload["trainDir"]
    model_name = payload["modelName"]
    base_model = payload.get("baseModel") or "cpsam"
    n_epochs = int(payload.get("nEpochs", 100))
    learning_rate = float(payload.get("learningRate", 1e-5))
    weight_decay = float(payload.get("weightDecay", 0.1))
    batch_size = int(payload.get("batchSize", 1))
    use_gpu = bool(payload.get("useGpu", True))

    if not Path(train_dir).is_dir():
        raise FileNotFoundError(f"Training dir not found: {train_dir}")

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    handler = _QueueLogHandler(loop, queue, n_epochs)
    train_logger = logging.getLogger("cellpose.train")
    train_logger.addHandler(handler)

    await emit({"job": "train", "progress": 0.0, "message": "loading training data"})

    def _do_train() -> str:
        (
            train_images, train_labels, _train_files,
            _test_images, _test_labels, _test_files,
        ) = cp_io.load_train_test_data(train_dir)
        model = cp_models.CellposeModel(gpu=use_gpu, pretrained_model=base_model)
        filename, _train_losses, _test_losses = cp_train.train_seg(
            model.net,
            train_data=train_images,
            train_labels=train_labels,
            n_epochs=n_epochs,
            learning_rate=learning_rate,
            weight_decay=weight_decay,
            batch_size=batch_size,
            save_path=train_dir,
            model_name=model_name,
        )
        return str(filename)

    drain_task = asyncio.create_task(_drain(queue, emit))
    try:
        model_path = await asyncio.to_thread(_do_train)
    finally:
        train_logger.removeHandler(handler)
        await queue.put(None)
        await drain_task

    await emit({"job": "train", "progress": 1.0, "message": "done"})
    return {"modelName": model_name, "modelPath": model_path}


# ---------------------------------------------------------------------------
# Shared drain
# ---------------------------------------------------------------------------


async def _drain(queue: asyncio.Queue, emit: Callable[[dict], Awaitable[None]]) -> None:
    while True:
        item = await queue.get()
        if item is None:
            return
        try:
            await emit(item)
        except Exception:
            return
