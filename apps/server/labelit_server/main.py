"""Labelit WebSocket server — FastAPI application."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Labelit Server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# In-memory label store (swap for DB later)
# ---------------------------------------------------------------------------


class Label(BaseModel):
    id: str
    name: str
    color: str
    createdAt: str
    updatedAt: str


_labels: dict[str, Label] = {}


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.active.remove(ws)

    async def broadcast(self, message: dict) -> None:
        for ws in self.active:
            await ws.send_json(message)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await ws.send_json({"type": "pong"})

            elif msg_type == "label:list":
                await ws.send_json({
                    "type": "label:listed",
                    "payload": list(_labels.values()),
                })

            elif msg_type == "label:create":
                payload = data.get("payload", {})
                now = datetime.now(UTC).isoformat()
                label = Label(
                    id=str(uuid.uuid4()),
                    name=payload.get("name", "Untitled"),
                    color=payload.get("color", "#808080"),
                    createdAt=now,
                    updatedAt=now,
                )
                _labels[label.id] = label
                await manager.broadcast({
                    "type": "label:created",
                    "payload": label.model_dump(),
                })

            elif msg_type == "label:update":
                payload = data.get("payload", {})
                label_id = payload.get("id")
                if label_id and label_id in _labels:
                    existing = _labels[label_id]
                    now = datetime.now(UTC).isoformat()
                    updated = existing.model_copy(
                        update={
                            k: v
                            for k, v in payload.items()
                            if k != "id" and v is not None
                        }
                        | {"updatedAt": now}
                    )
                    _labels[label_id] = updated
                    await manager.broadcast({
                        "type": "label:updated",
                        "payload": updated.model_dump(),
                    })
                else:
                    await ws.send_json({
                        "type": "error",
                        "payload": {"message": f"Label {label_id} not found"},
                    })

            elif msg_type == "label:delete":
                payload = data.get("payload", {})
                label_id = payload.get("id")
                if label_id and label_id in _labels:
                    del _labels[label_id]
                    await manager.broadcast({
                        "type": "label:deleted",
                        "payload": {"id": label_id},
                    })
                else:
                    await ws.send_json({
                        "type": "error",
                        "payload": {"message": f"Label {label_id} not found"},
                    })

            else:
                await ws.send_json({
                    "type": "error",
                    "payload": {"message": f"Unknown message type: {msg_type}"},
                })

    except WebSocketDisconnect:
        manager.disconnect(ws)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run() -> None:
    uvicorn.run(
        "labelit_server.main:app",
        host="127.0.0.1",
        port=8765,
        reload=True,
    )


if __name__ == "__main__":
    run()
