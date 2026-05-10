import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "@labelit/contracts";
import { useWebSocket } from "@/hooks/use-websocket";
import { useSessionStore } from "@/stores/session-store";
import { useToolStore } from "@/stores/tool-store";
import { cn } from "@/lib/utils";

interface DisplayBox {
  // The rendered <img>'s bounding rect within the canvas area.
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
  // The image is rendered "object-contain" inside the container.
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

export function CanvasArea() {
  const { send } = useWebSocket();
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  const tool = useToolStore((s) => s.tool);
  const brushSize = useToolStore((s) => s.brushSize);
  const showMasks = useToolStore((s) => s.showMasks);

  const containerRef = useRef<HTMLDivElement>(null);
  const [strokePath, setStrokePath] = useState<Point[] | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const screenToImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const container = containerRef.current;
      if (!container || !image) return null;
      const rect = container.getBoundingClientRect();
      const box = imageToDisplayBox(rect, image.width, image.height);
      const xInBox = clientX - rect.left - box.left;
      const yInBox = clientY - rect.top - box.top;
      if (xInBox < 0 || yInBox < 0 || xInBox > box.width || yInBox > box.height) return null;
      return {
        x: (xInBox / box.width) * image.width,
        y: (yInBox / box.height) * image.height,
      };
    },
    [image],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    const p = screenToImage(e.clientX, e.clientY);
    if (!p) return;
    if (tool === "brush") {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setStrokePath([p]);
    } else if (tool === "delete") {
      send({ type: "mask:remove_at", payload: { x: p.x, y: p.y } });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    const p = screenToImage(e.clientX, e.clientY);
    setPointer(p);
    if (tool === "brush" && strokePath) {
      // Throttle by minimum displacement so we don't accumulate thousands of points.
      const last = strokePath[strokePath.length - 1];
      if (p && (Math.abs(p.x - last.x) >= 1 || Math.abs(p.y - last.y) >= 1)) {
        setStrokePath([...strokePath, p]);
      }
    }
  };

  const finishStroke = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "brush" && strokePath && strokePath.length > 0) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      send({
        type: "mask:stroke",
        payload: { points: strokePath, radius: brushSize },
      });
      setStrokePath(null);
    }
  };

  // Track display box for overlaying the stroke preview.
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
        "relative flex flex-1 flex-col overflow-hidden bg-[oklch(0.18_0_0)] dark:bg-[oklch(0.12_0_0)]",
        cursorClass,
      )}
      onPointerCancel={finishStroke}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => setPointer(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      ref={containerRef}
    >
      {image?.previewPng ? (
        <>
          <img
            alt="image"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            draggable={false}
            src={`data:image/png;base64,${image.previewPng}`}
          />
          {showMasks && mask?.previewPng && (
            <img
              alt="masks"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain mix-blend-normal"
              draggable={false}
              src={`data:image/png;base64,${mask.previewPng}`}
            />
          )}
          {/* In-flight stroke preview */}
          {box && strokePath && strokePath.length > 0 && (
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
              <polyline
                fill="none"
                points={strokePath.map((p) => `${p.x},${p.y}`).join(" ")}
                stroke="rgb(255,210,80)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.85"
                strokeWidth={2 * brushSize}
              />
            </svg>
          )}
          {/* Brush cursor halo */}
          {box && tool === "brush" && pointer && (
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
              <circle
                cx={pointer.x}
                cy={pointer.y}
                fill="none"
                r={brushSize}
                stroke="rgba(255,255,255,0.7)"
                strokeWidth={1}
              />
            </svg>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-md border border-white/10 bg-[oklch(0.22_0_0)] p-8 text-center font-mono text-white/40 text-xs">
            open an image to begin
          </div>
        </div>
      )}

      {/* Floating canvas label */}
      <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-sm">
        {image
          ? `${image.path.split(/[\\/]/).pop()} · Z 1/${image.depth} · ${image.channels}ch`
          : "no image loaded"}
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-sm">
        {mask ? `${mask.nRois} ROIs` : "no masks"}
        {pointer ? ` · x ${pointer.x.toFixed(0)} y ${pointer.y.toFixed(0)}` : ""}
      </div>
    </div>
  );
}
