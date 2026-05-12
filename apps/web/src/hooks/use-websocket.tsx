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
export type WebsocketRoute = "cellpose" | "cellacdc";

const DEFAULT_WS_BASE = "ws://127.0.0.1:8765";

function detectRoute(): WebsocketRoute {
  return window.location.pathname.toLowerCase().includes("/cellacdc")
    ? "cellacdc"
    : "cellpose";
}

function wsBaseFromEnv(): string {
  const raw = import.meta.env.VITE_WS_URL?.trim();
  if (!raw) return DEFAULT_WS_BASE;
  const isWsUrl = raw.startsWith("ws://") || raw.startsWith("wss://");
  if (!isWsUrl) return raw.replace(/\/+$/, "");
  try {
    const parsed = new URL(raw);
    const hasWsPath =
      parsed.pathname === "/ws" ||
      parsed.pathname.endsWith("/ws") ||
      parsed.pathname.endsWith("/ws/") ||
      parsed.pathname.endsWith("/ws/cellpose") ||
      parsed.pathname.endsWith("/ws/cellpose/") ||
      parsed.pathname.endsWith("/ws/cellacdc") ||
      parsed.pathname.endsWith("/ws/cellacdc/");
    const basePath = hasWsPath ? parsed.pathname.replace(/\/ws(?:\/cellpose|\/cellacdc)?\/?$/, "") : parsed.pathname;
    return `${parsed.origin}${basePath}`.replace(/\/+$/, "");
  } catch {
    return raw
      .replace(/\/ws(?:\/cellpose|\/cellacdc)?\/?$/, "")
      .replace(/\/+$/, "");
  }
}

interface WsContextValue {
  status: ConnectionStatus;
  route: WebsocketRoute;
  send: (msg: ClientMessage) => void;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const route = useMemo(() => detectRoute(), []);
  const baseWsUrl = useMemo(() => wsBaseFromEnv(), []);

  const {
    setRoots,
    setDir,
    setHome,
    setError: setFsError,
    setLoading: setFsLoading,
    setSuggestedTemplates,
  } = useFsStore();
  const {
    setCellacdcAnnotations,
    setImage,
    setMask,
    setModels,
    setProgress,
    setRunDone,
    setSeriesDataset,
  } = useSessionStore();

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
        case "fs:series_templates_suggested":
          setSuggestedTemplates(msg.payload);
          break;
        case "fs:series_dataset_loaded": {
          const dataset = msg.payload;
          const coords: Record<string, number> = {};
          for (const [axis, length] of Object.entries(dataset.axes)) {
            if (length > 0) coords[axis] = 0;
          }
          setSeriesDataset(dataset, coords);

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "image:open_series",
                payload: {
                  folder: dataset.folder,
                  subfolder_template: dataset.subfolder_template,
                  filename_template: dataset.filename_template,
                  position: coords.position ?? 0,
                  time: coords.time ?? 0,
                  channel: coords.channel ?? 0,
                  z: coords.z ?? 0,
                },
              }),
            );
          }
          break;
        }
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
          if (route === "cellacdc") {
            const current = useSessionStore.getState().params.model;
            const hasCurrent = msg.payload.some((model) => model.name === current);
            if (!hasCurrent) {
              const fallback =
                msg.payload.find((model) => model.name === "Automatic thresholding" && model.available !== false) ??
                msg.payload.find((model) => model.name === "cellpose_v4" && model.available !== false) ??
                msg.payload.find((model) => model.available !== false);
              if (fallback) useSessionStore.getState().setParams({ model: fallback.name });
            }
          }
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
        case "cellacdc:annotations_updated":
          setCellacdcAnnotations(msg.payload.annotations);
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
    [
      setRoots,
      setDir,
      setHome,
      setSuggestedTemplates,
      setSeriesDataset,
      setImage,
      setMask,
      setModels,
      setProgress,
      setRunDone,
      setCellacdcAnnotations,
      setFsError,
      setFsLoading,
      route,
    ],
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const wsPath = route === "cellacdc" ? "/ws/cellacdc" : "/ws/cellpose";
    const ws = new WebSocket(`${baseWsUrl}${wsPath}`);

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
  }, [baseWsUrl, handleMessage, route]);

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

  const value = useMemo(() => ({ status, route, send }), [status, route, send]);
  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWebSocket(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWebSocket must be used inside <WebSocketProvider>");
  return ctx;
}
