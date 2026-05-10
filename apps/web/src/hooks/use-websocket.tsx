import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClientMessage, ServerMessage } from "@labelit/contracts";
import { ServerMessageSchema } from "@labelit/contracts";
import { useFsStore } from "../stores/fs-store";
import { useSessionStore } from "../stores/session-store";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://127.0.0.1:8765/ws";

interface WsContextValue {
  status: ConnectionStatus;
  send: (msg: ClientMessage) => void;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const {
    setRoots,
    setDir,
    setHome,
    setError: setFsError,
    setLoading: setFsLoading,
  } = useFsStore();
  const { setImage, setMask, setModels, setProgress, setRunDone } = useSessionStore();

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = ServerMessageSchema.parse(JSON.parse(String(event.data)));
      } catch (err) {
        console.error("[ws] failed to parse message:", err);
        return;
      }

      switch (msg.type) {
        case "fs:roots_listed":
          setRoots(msg.payload);
          break;
        case "fs:dir_listed":
          setDir(msg.payload);
          break;
        case "fs:home_resolved":
          setHome(msg.payload.path);
          break;
        case "image:opened":
          setImage(msg.payload);
          break;
        case "image:saved":
          break;
        case "mask:updated":
          setMask(msg.payload);
          break;
        case "model:listed":
          setModels(msg.payload);
          break;
        case "model:progress":
          setProgress(msg.payload);
          break;
        case "model:run_done":
          setRunDone(msg.payload.segPath);
          break;
        case "model:train_done":
          setProgress(null);
          break;
        case "pong":
          break;
        case "error":
          console.error("[ws] server error:", msg.payload.message);
          setFsError(msg.payload.message);
          setFsLoading(false);
          break;
      }
    },
    [setRoots, setDir, setHome, setImage, setMask, setModels, setProgress, setRunDone, setFsError, setFsLoading],
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatus("connected");
      ws.send(JSON.stringify({ type: "fs:home" }));
      ws.send(JSON.stringify({ type: "model:list" }));
      ws.send(JSON.stringify({ type: "mask:request" }));
    };
    ws.onmessage = handleMessage;
    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("[ws] cannot send, socket not open:", msg.type);
    }
  }, []);

  const value = useMemo(() => ({ status, send }), [status, send]);
  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWebSocket(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWebSocket must be used inside <WebSocketProvider>");
  return ctx;
}
