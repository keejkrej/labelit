import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CanvasArea } from "@/components/canvas-area";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { HeaderMenus } from "@/components/header-menus";
import { useSessionStore } from "@/stores/session-store";
import { useToolStore } from "@/stores/tool-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { useShortcuts } from "@/hooks/use-shortcuts";
import {
  Eraser,
  Lasso,
  Maximize2,
  MousePointer2,
  Move,
  MousePointerClick,
  PencilLine,
  Settings2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

function StatusDot({
  status,
}: {
  status: "connected" | "connecting" | "disconnected";
}) {
  const cls =
    status === "connected"
      ? "bg-success-foreground animate-pulse"
      : status === "connecting"
        ? "bg-warning-foreground animate-pulse"
        : "bg-destructive-foreground";
  return <span className={`size-1.5 rounded-full ${cls}`} />;
}

function Toolbar() {
  const tool = useToolStore((s) => s.tool);
  const setTool = useToolStore((s) => s.setTool);
  const setZoom = useToolStore((s) => s.setZoom);
  const resetView = useToolStore((s) => s.resetView);

  const toolButton = (
    value: "pointer" | "pan" | "brush" | "delete" | "select-click" | "select-region",
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
  ) => (
    <Button
      aria-label={label}
      aria-pressed={tool === value}
      className={`rounded-full ${tool === value ? "bg-accent" : ""}`}
      onClick={() => setTool(value)}
      size="icon-xs"
      variant="ghost"
    >
      <Icon />
    </Button>
  );

  return (
    <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background/80 px-4 py-1.5 shadow-lg backdrop-blur-md">
      {toolButton("pointer", "Pointer (V)", MousePointer2)}
      {toolButton("pan", "Pan", Move)}
      {toolButton("brush", "Brush (B)", PencilLine)}
      {toolButton("delete", "Delete ROI (E)", Eraser)}
      {toolButton("select-click", "Click-select ROIs to delete", MousePointerClick)}
      {toolButton("select-region", "Region-select ROIs to delete (double-click to close)", Lasso)}
      <div className="mx-2 h-5 w-px bg-border/50" />
      <Button size="icon-xs" variant="ghost" className="rounded-full" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}>
        <ZoomOut />
      </Button>
      <Button size="icon-xs" variant="ghost" className="rounded-full" onClick={() => setZoom((z) => Math.min(20, z * 1.2))}>
        <ZoomIn />
      </Button>
      <Button size="icon-xs" variant="ghost" className="rounded-full" onClick={resetView}>
        <Maximize2 />
      </Button>
      <div className="mx-2 h-5 w-px bg-border/50" />
      <Button size="icon-xs" variant="ghost" className="rounded-full">
        <Settings2 />
      </Button>
    </div>
  );
}

function AppShell() {
  const { status } = useWebSocket();
  useShortcuts();
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <header className="relative z-10 flex items-center justify-between border-border/50 border-b bg-background/60 backdrop-blur-md px-3 py-1.5 shadow-sm">
        <div className="flex items-center gap-4">
          <a className="rounded px-1.5 text-[11px] hover:underline" href="/">
            Cellpose
          </a>
          <a className="rounded px-1.5 text-[11px] hover:underline" href="/cellacdc">
            CellACDC
          </a>
          <HeaderMenus />
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              status === "connected"
                ? "success"
                : status === "connecting"
                  ? "warning"
                  : "destructive"
            }
          >
            <StatusDot status={status} />
            {status}
          </Badge>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CanvasArea />
        <RightSidebar />
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
          <Toolbar />
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-between border-border/50 border-t bg-background/60 backdrop-blur-md px-3 py-1 text-muted-foreground text-xs shadow-sm">
        <span>cellpose v4.1 · server-driven IO · GPU optional</span>
        <span>
          {mask ? `${mask.nRois} ROIs` : "0 ROIs"} ·{" "}
          {image ? `${image.width}×${image.height}` : "no image"}
        </span>
      </footer>
    </div>
  );
}

export function CellposePage() {
  return <AppShell />;
}

