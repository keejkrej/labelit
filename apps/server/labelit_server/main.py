"""Labelit WebSocket server — FastAPI application.

All file IO and model train/inference for the webapp goes through this server.
The webapp only renders state; pixel data and model weights never leave this
process unless explicitly saved.
"""

from __future__ import annotations

import traceback

import uvicorn
from cellpose.gui import series
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from labelit_contracts import SeriesDatasetPayload

from . import fs, images, masks, models

app = FastAPI(title="Labelit Server", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def _send_error(ws: WebSocket, message: str) -> None:
    await ws.send_json({"type": "error", "payload": {"message": message}})


async def _send_mask_state(ws: WebSocket) -> None:
    await ws.send_json({"type": "mask:updated", "payload": masks.current_state()})


async def _dispatch(ws: WebSocket, msg_type: str, payload: dict) -> None:
    if msg_type == "ping":
        await ws.send_json({"type": "pong"})
        return

    # ----- filesystem -----
    if msg_type == "fs:list_roots":
        await ws.send_json({"type": "fs:roots_listed", "payload": fs.list_roots()})
        return
    if msg_type == "fs:list_dir":
        path = payload.get("path")
        if not path:
            raise ValueError("fs:list_dir requires payload.path")
        result = fs.list_dir(path, patterns=payload.get("patterns"))
        await ws.send_json({"type": "fs:dir_listed", "payload": result})
        return
    if msg_type == "fs:home":
        await ws.send_json({"type": "fs:home_resolved", "payload": fs.resolve_home()})
        return
    if msg_type == "fs:suggest_series_templates":
        folder = payload.get("folder")
        if not folder:
            raise ValueError("fs:suggest_series_templates requires payload.folder")
        result = series.suggest_series_templates(folder)
        await ws.send_json({"type": "fs:series_templates_suggested", "payload": result})
        return
    if msg_type == "fs:load_series_dataset":
        folder = payload.get("folder")
        if not folder:
            raise ValueError("fs:load_series_dataset requires payload.folder")
        result = series.build_series_dataset(
            folder,
            subfolder_template=payload.get("subfolder_template", ""),        
            filename_template=payload.get("filename_template", "")
        )
        
        # Use Pydantic to validate and sanitize the payload, dropping internal non-serializable fields like 'lookup'.
        safe_payload = SeriesDatasetPayload(**result).model_dump()
        await ws.send_json({"type": "fs:series_dataset_loaded", "payload": safe_payload})
        return
    # ----- images -----
    if msg_type == "image:open":
        result = images.open_image(payload["path"])
        masks.reset_history(result["path"])
        await ws.send_json({"type": "image:opened", "payload": result})
        await _send_mask_state(ws)
        return
    if msg_type == "image:open_series":
        dataset = series.build_series_dataset(
            payload["folder"],
            subfolder_template=payload.get("subfolder_template", ""),
            filename_template=payload.get("filename_template", "")
        )
        idx = series.resolve_series_record_index(
            dataset,
            position=payload["position"],
            time=payload["time"],
            channel=payload["channel"],
            z=payload["z"]
        )
        path = dataset["records"][idx]["path"]
        result = images.open_image(path)
        masks.reset_history(result["path"])
        await ws.send_json({"type": "image:opened", "payload": result})
        await _send_mask_state(ws)
        return
    if msg_type == "image:open_masks":
        masks_path = payload["path"]
        image_path = payload.get("imagePath", masks_path)
        images.open_masks(image_path, masks_path)
        masks.reset_history(image_path)
        await _send_mask_state(ws)
        return

    # ----- saves -----
    if msg_type == "image:save_seg":
        await ws.send_json({"type": "image:saved", "payload": images.save_seg(payload.get("path"))})
        return
    if msg_type == "image:save_masks":
        await ws.send_json({"type": "image:saved", "payload": images.save_masks_png(payload.get("path"))})
        return
    if msg_type == "image:save_outlines":
        await ws.send_json({"type": "image:saved", "payload": images.save_outlines_text(payload.get("path"))})
        return
    if msg_type == "image:save_rois":
        await ws.send_json({"type": "image:saved", "payload": images.save_rois_zip(payload.get("path"))})
        return
    if msg_type == "image:save_flows":
        await ws.send_json({"type": "image:saved", "payload": images.save_flows_tif(payload.get("path"))})
        return

    # ----- mask edits -----
    if msg_type == "mask:stroke":
        state = masks.stroke(payload["points"], int(payload["radius"]), bool(payload.get("erase", False)))
        await ws.send_json({"type": "mask:updated", "payload": state})
        return
    if msg_type == "mask:remove_at":
        state = masks.remove_at(payload["x"], payload["y"])
        await ws.send_json({"type": "mask:updated", "payload": state})
        return
    if msg_type == "mask:remove_at_points":
        state = masks.remove_at_points(payload["points"])
        await ws.send_json({"type": "mask:updated", "payload": state})
        return
    if msg_type == "mask:remove_in_region":
        state = masks.remove_in_region(payload["polygon"])
        await ws.send_json({"type": "mask:updated", "payload": state})
        return
    if msg_type == "mask:merge_at":
        state = masks.merge_at(payload["a"], payload["b"])
        await ws.send_json({"type": "mask:updated", "payload": state})
        return
    if msg_type == "mask:clear":
        await ws.send_json({"type": "mask:updated", "payload": masks.clear()})
        return
    if msg_type == "mask:undo":
        await ws.send_json({"type": "mask:updated", "payload": masks.undo()})
        return
    if msg_type == "mask:redo":
        await ws.send_json({"type": "mask:updated", "payload": masks.redo()})
        return
    if msg_type == "mask:request":
        await _send_mask_state(ws)
        return

    # ----- models -----
    if msg_type == "model:list":
        await ws.send_json({"type": "model:listed", "payload": models.list_models()})
        return
    if msg_type == "model:run":
        async def emit_progress(p: dict) -> None:
            await ws.send_json({"type": "model:progress", "payload": p})

        result = await models.run_segmentation(payload, emit_progress)
        # Segmentation replaced the mask; reset history and broadcast new state.
        masks.reset_history(result["imagePath"])
        await ws.send_json({"type": "model:run_done", "payload": result})
        await _send_mask_state(ws)
        return
    if msg_type == "model:train":
        async def emit_train(p: dict) -> None:
            await ws.send_json({"type": "model:progress", "payload": p})

        result = await models.train_model(payload, emit_train)
        await ws.send_json({"type": "model:train_done", "payload": result})
        return

    raise ValueError(f"Unknown message type: {msg_type}")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")
            payload = data.get("payload") or {}
            try:
                await _dispatch(ws, msg_type, payload)
            except Exception as exc:
                traceback.print_exc()
                await _send_error(ws, f"{type(exc).__name__}: {exc}")
    except WebSocketDisconnect:
        return


def run() -> None:
    uvicorn.run(
        "labelit_server.main:app",
        host="127.0.0.1",
        port=8765,
        reload=True,
    )


if __name__ == "__main__":
    run()
