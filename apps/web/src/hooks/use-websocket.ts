import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, ServerMessage } from "@labelit/contracts";
import { ServerMessageSchema } from "@labelit/contracts";
import { useLabelStore } from "../stores/label-store";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://127.0.0.1:8765/ws";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { setLabels, addLabel, updateLabel, removeLabel } = useLabelStore();

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const raw = JSON.parse(String(event.data));
        const msg: ServerMessage = ServerMessageSchema.parse(raw);

        switch (msg.type) {
          case "label:listed":
            setLabels(msg.payload);
            break;
          case "label:created":
            addLabel(msg.payload);
            break;
          case "label:updated":
            updateLabel(msg.payload);
            break;
          case "label:deleted":
            removeLabel(msg.payload.id);
            break;
          case "pong":
            break;
          case "error":
            console.error("[ws] server error:", msg.payload.message);
            break;
        }
      } catch (err) {
        console.error("[ws] failed to parse message:", err);
      }
    },
    [setLabels, addLabel, updateLabel, removeLabel],
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatus("connected");
      // Request initial label list
      ws.send(JSON.stringify({ type: "label:list" }));
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      // Auto-reconnect after 2s
      reconnectTimerRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { status, sendMessage };
}
