import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { Point } from "@labelit/contracts";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/use-websocket";
import { useSessionStore } from "@/stores/session-store";
import { useToolStore } from "@/stores/tool-store";
import { cn } from "@/lib/utils";

interface DisplayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function imageToDisplayBox(
  container: DOMRect,
  imageWidth: number,
  imageHeight: number,
): DisplayBox {
  const containerAspect = container.width / container.height;
  const imageAspect = imageWidth / imageHeight;
  let width: number;
  let height: number;
  if (containerAspect > imageAspect) {
    height = container.height;
    width = height * imageAspect;
  } else {
    width = container.width;
    height = width / imageAspect;
  }
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
}

// Minimum point displacement to record (image pixels).
const STROKE_MIN_PX = 1;

export function CanvasArea() {
  const { send } = useWebSocket();
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  const tool = useToolStore((s) => s.tool);
  const brushSize = useToolStore((s) => s.brushSize);
  const showMasks = useToolStore((s) => s.showMasks);
  const showOutlines = useToolStore((s) => s.showOutlines);

  const pendingMerge = useToolStore((s) => s.pendingMerge);
  const setPendingMerge = useToolStore((s) => s.setPendingMerge);
  const pickedPoints = useToolStore((s) => s.pickedPoints);
  const addPickedPoint = useToolStore((s) => s.addPickedPoint);
  const clearPickedPoints = useToolStore((s) => s.clearPickedPoints);
  const regionPath = useToolStore((s) => s.regionPath);
  const addRegionVertex = useToolStore((s) => s.addRegionVertex);
  const clearRegion = useToolStore((s) => s.clearRegion);

  const zoom = useToolStore((s) => s.zoom);
  const setZoom = useToolStore((s) => s.setZoom);
  const pan = useToolStore((s) => s.pan);
  const setPan = useToolStore((s) => s.setPan);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<Point | null>(null);

  // Streaming stroke state.
  const strokeActiveRef = useRef(false);
  const strokeBufferRef = useRef<Point[]>([]);
  const lastSentPointRef = useRef<Point | null>(null);
  const [livePath, setLivePath] = useState<Point[]>([]);

  const screenToImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const container = containerRef.current;
      if (!container || !image) return null;
      const rect = container.getBoundingClientRect();
      const box = imageToDisplayBox(rect, image.width, image.height);
      let xInBox = clientX - rect.left - box.left;
      let yInBox = clientY - rect.top - box.top;

      xInBox = (xInBox - pan.x) / zoom;
      yInBox = (yInBox - pan.y) / zoom;

      if (xInBox < 0 || yInBox < 0 || xInBox > box.width || yInBox > box.height) return null;
      return {
        x: (xInBox / box.width) * image.width,
        y: (yInBox / box.height) * image.height,
      };
    },
    [image, pan, zoom],
  );

  // ---------------- streaming stroke helpers ----------------

  const cleanupStroke = useCallback(() => {
    strokeBufferRef.current = [];
    lastSentPointRef.current = null;
    strokeActiveRef.current = false;
    // We preserve livePath here so the mask contour doesn't flicker before the server responds.
  }, []);

  useEffect(() => () => cleanupStroke(), [cleanupStroke]);

  // Clear live path when mask updates from the server, avoiding flicker.
  useEffect(() => {
    if (!strokeActiveRef.current) {
      setLivePath([]);
    }
  }, [mask]);

  // Clear live path if the tool changes away from brush.
  useEffect(() => {
    if (tool !== "brush") {
      setLivePath([]);
    }
  }, [tool]);

  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!mask || (!showMasks && !showOutlines)) return;

    // Convert roi ID to a distinct hue
    const getHsla = (id: number, alpha: number) => {
      const hue = (id * 137.508) % 360;
      return `hsla(${hue}, 80%, 60%, ${alpha})`;
    };

    for (const roi of mask.rois) {
      ctx.beginPath();
      for (const contour of roi.contours) {
        if (contour.length === 0) continue;
        ctx.moveTo(contour[0][0], contour[0][1]);
        for (let i = 1; i < contour.length; i++) {
          ctx.lineTo(contour[i][0], contour[i][1]);
        }
        ctx.closePath();
      }

      if (showMasks) {
        ctx.fillStyle = getHsla(roi.id, 0.6);
        ctx.fill();
      }
      if (showOutlines) {
        ctx.strokeStyle = "rgba(255, 240, 90, 0.9)";
        ctx.lineWidth = Math.max(1, image.width * 0.001);
        ctx.stroke();
      }
    }
  }, [mask, image, showMasks, showOutlines]);

  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;

    if (tool === "pan") {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    const p = screenToImage(e.clientX, e.clientY);
    if (!p) return;

    // Alt+click → two-step merge across any tool.
    if (e.altKey && !e.shiftKey && !e.ctrlKey) {
      if (pendingMerge) {
        send({ type: "mask:merge_at", payload: { a: pendingMerge, b: p } });
        setPendingMerge(null);
      } else {
        setPendingMerge(p);
      }
      return;
    }

    // Ctrl+click → delete the ROI under the pixel, regardless of tool.
    if (e.ctrlKey || e.metaKey) {
      send({ type: "mask:remove_at", payload: { x: p.x, y: p.y } });
      return;
    }

    if (tool === "brush") {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      strokeActiveRef.current = true;
      lastSentPointRef.current = p;
      strokeBufferRef.current = [p];
      setLivePath([p]);
      return;
    }
    if (tool === "delete") {
      send({ type: "mask:remove_at", payload: { x: p.x, y: p.y } });
      return;
    }
    if (tool === "select-click") {
      addPickedPoint(p);
      return;
    }
    if (tool === "select-region") {
      addRegionVertex(p);
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;

    if (isPanningRef.current && lastPanPointRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const p = screenToImage(e.clientX, e.clientY);
    setPointer(p);
    if (!p) return;

    if (tool === "brush" && strokeActiveRef.current) {
      const last = lastSentPointRef.current;
      if (
        last == null ||
        Math.abs(p.x - last.x) >= STROKE_MIN_PX ||
        Math.abs(p.y - last.y) >= STROKE_MIN_PX
      ) {
        strokeBufferRef.current.push(p);
        lastSentPointRef.current = p;
        setLivePath((path) => [...path, p]);
      }
    }
  };

  const finishStroke = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (tool === "brush" && strokeActiveRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      
      const points = strokeBufferRef.current;
      if (points.length > 0) {
        send({ 
          type: "mask:stroke", 
          payload: { points, radius: brushSize }
        });
      }
      
      cleanupStroke();
    }
  };

  // Double-click closes a region polygon and dispatches the delete.
  const handleDoubleClick = () => {
    if (tool === "select-region" && regionPath.length >= 3) {
      send({ type: "mask:remove_in_region", payload: { polygon: regionPath } });
      clearRegion();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!image || !containerRef.current) return;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    setZoom((z) => {
      const newZoom = Math.max(0.1, Math.min(20, z * zoomFactor));
      const effectiveFactor = newZoom / z;
      setPan((p) => ({
        x: cx - (cx - p.x) * effectiveFactor,
        y: cy - (cy - p.y) * effectiveFactor,
      }));
      return newZoom;
    });
  };

  // ---------------- display box for overlay svgs ----------------
  const [box, setBox] = useState<DisplayBox | null>(null);
  useEffect(() => {
    if (!containerRef.current || !image) {
      setBox(null);
      return;
    }
    const update = () => {
      if (!containerRef.current || !image) return;
      const rect = containerRef.current.getBoundingClientRect();
      setBox(imageToDisplayBox(rect, image.width, image.height));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [image]);

  // ---------------- selection commit/cancel ----------------
  const commitPicked = () => {
    if (pickedPoints.length > 0) {
      send({ type: "mask:remove_at_points", payload: { points: pickedPoints } });
      clearPickedPoints();
    }
  };
  const commitRegion = () => {
    if (regionPath.length >= 3) {
      send({ type: "mask:remove_in_region", payload: { polygon: regionPath } });
      clearRegion();
    }
  };

  // ESC cancels pending merge / pending selections.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingMerge) setPendingMerge(null);
        if (regionPath.length > 0) clearRegion();
        if (pickedPoints.length > 0) clearPickedPoints();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingMerge, regionPath, pickedPoints, setPendingMerge, clearRegion, clearPickedPoints]);

  const cursorClass =
    tool === "brush"
      ? "cursor-crosshair"
      : tool === "delete"
        ? "cursor-not-allowed"
        : tool === "pan"
          ? "cursor-grab"
          : "cursor-default";

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden select-none bg-[oklch(0.18_0_0)] dark:bg-[oklch(0.12_0_0)]",
        cursorClass,
      )}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onPointerCancel={finishStroke}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => setPointer(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      ref={containerRef}
    >
      {image?.previewPng ? (
        <div
          className="absolute inset-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <img
            alt="image"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            draggable={false}
            src={`data:image/png;base64,${image.previewPng}`}
            />
            <canvas
              ref={maskCanvasRef}
              width={image.width}
              height={image.height}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
            {/* Draw ROI centroids and IDs for debugging if needed, but skipped for now */}

          {box && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              }}
              viewBox={`0 0 ${image.width} ${image.height}`}
            >
              {/* In-flight stroke preview */}
              {livePath.length > 1 && (
                <polygon
                  fill="rgba(255,210,80,0.3)"
                  points={livePath.map((p) => `${p.x},${p.y}`).join(" ")}
                  stroke="rgb(255,210,80)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.85"
                  strokeWidth={2 * brushSize}
                />
              )}
              {/* Region-select path */}
              {regionPath.length > 0 && (
                <polyline
                  fill="rgba(120,200,255,0.15)"
                  points={[...regionPath, regionPath[0]]
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}
                  stroke="rgb(120,200,255)"
                  strokeDasharray="4 3"
                  strokeWidth={Math.max(1, image.width * 0.002)}
                />
              )}
              {/* Region vertices */}
              {regionPath.map((p, i) => (
                <circle
                  cx={p.x}
                  cy={p.y}
                  fill="rgb(120,200,255)"
                  key={i}
                  r={Math.max(2, image.width * 0.003)}
                />
              ))}
              {/* Click-select picks */}
              {pickedPoints.map((p, i) => (
                <circle
                  cx={p.x}
                  cy={p.y}
                  fill="none"
                  key={i}
                  r={Math.max(4, image.width * 0.006)}
                  stroke="rgb(255,90,90)"
                  strokeWidth={Math.max(1, image.width * 0.0025)}
                />
              ))}
              {/* Brush cursor halo */}
              {tool === "brush" && pointer && (
                <circle
                  cx={pointer.x}
                  cy={pointer.y}
                  fill="none"
                  r={brushSize}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={1}
                />
              )}
              {/* Merge pending marker */}
              {pendingMerge && (
                <circle
                  cx={pendingMerge.x}
                  cy={pendingMerge.y}
                  fill="none"
                  r={Math.max(4, image.width * 0.008)}
                  stroke="rgb(160,255,160)"
                  strokeWidth={Math.max(1, image.width * 0.003)}
                />
              )}
            </svg>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-md border border-white/10 bg-[oklch(0.22_0_0)] p-8 text-center font-mono text-white/40 text-xs">
            open an image to begin
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="pointer-events-none select-none absolute top-3 left-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium tracking-wide text-white/80 backdrop-blur-sm shadow-sm">
        {image
          ? `${image.path.split(/[\\/]/).pop()} · Z 1/${image.depth} · ${image.channels}ch`
          : "no image loaded"}
      </div>
      <div className="pointer-events-none select-none absolute right-3 bottom-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium tracking-wide text-white/80 backdrop-blur-sm shadow-sm">
        {mask ? `${mask.nRois} ROIs` : "no masks"}
        {pointer ? ` · x ${pointer.x.toFixed(0)} y ${pointer.y.toFixed(0)}` : ""}
      </div>

      {/* Pending merge banner */}
      {pendingMerge && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-black/50 px-3 py-1 text-xs font-medium tracking-wide text-white/90 backdrop-blur-sm shadow-sm border border-white/10">
          Alt+click another cell to merge · Esc to cancel
        </div>
      )}

      {/* Selection commit/cancel HUD */}
      {(tool === "select-click" || tool === "select-region") && (
        <SelectionCommitBar
          tool={tool}
          pickedCount={pickedPoints.length}
          regionVertices={regionPath.length}
          onCommit={tool === "select-click" ? commitPicked : commitRegion}
          onCancel={() => {
            clearPickedPoints();
            clearRegion();
          }}
        />
      )}
    </div>
  );
}

function SelectionCommitBar({
  tool,
  pickedCount,
  regionVertices,
  onCommit,
  onCancel,
}: {
  tool: "select-click" | "select-region";
  pickedCount: number;
  regionVertices: number;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const ready =
    tool === "select-click" ? pickedCount > 0 : regionVertices >= 3;
  const label =
    tool === "select-click"
      ? `${pickedCount} ROI${pickedCount === 1 ? "" : "s"} picked`
      : `${regionVertices} vertices · double-click to close`;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md">
      <span className="tracking-wide">{label}</span>
      <Button
        className="h-6"
        disabled={!ready}
        onClick={onCommit}
        size="xs"
        variant="default"
      >
        <Check />
        delete
      </Button>
      <Button className="h-6" onClick={onCancel} size="xs" variant="outline">
        <X />
        cancel
      </Button>
    </div>
  );
}
