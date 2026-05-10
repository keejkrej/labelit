import { useWebSocket, WebSocketProvider } from "./hooks/use-websocket";
import { useShortcuts } from "./hooks/use-shortcuts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CanvasArea } from "@/components/canvas-area";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { FileBrowserDialog } from "@/components/file-browser-dialog";
import { HeaderMenus } from "@/components/header-menus";
import { SaveMenu } from "@/components/save-menu";
import { useFsStore } from "@/stores/fs-store";
import { useSessionStore } from "@/stores/session-store";
import { useToolStore } from "@/stores/tool-store";
import {
  Eraser,
  FileText,
  FolderOpen,
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

export function App() {
  return (
    <WebSocketProvider>
      <AppShell />
      <FileBrowserDialog />
    </WebSocketProvider>
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
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PencilLine className="size-3.5" />
            </div>
            <span className="font-semibold text-sm">Labelit</span>
            <span className="text-muted-foreground text-xs">
              · cellpose-style segmentation
            </span>
          </div>
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

      <Toolbar />

      <main className="relative flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CanvasArea />
        <RightSidebar />
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

function Toolbar() {
  const openBrowser = useFsStore((s) => s.openBrowser);
  const image = useSessionStore((s) => s.image);
  const tool = useToolStore((s) => s.tool);
  const setTool = useToolStore((s) => s.setTool);

  const toolButton = (
    value: "pointer" | "pan" | "brush" | "delete" | "select-click" | "select-region",
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
  ) => (
    <Button
      aria-label={label}
      aria-pressed={tool === value}
      className={tool === value ? "bg-accent" : ""}
      onClick={() => setTool(value)}
      size="icon-xs"
      variant="ghost"
    >
      <Icon />
    </Button>
  );

  return (
    <div className="relative z-10 flex items-center gap-1 border-border/50 border-b bg-background/60 backdrop-blur-md px-3 py-1.5 shadow-sm">
      <Button onClick={() => openBrowser("image")} size="xs" variant="ghost">
        <FolderOpen />
        open image
      </Button>
      <Button
        disabled={!image}
        onClick={() => openBrowser("mask")}
        size="xs"
        variant="ghost"
      >
        <FileText />
        open mask
      </Button>
      <SaveMenu />
      <div className="mx-1 h-4 w-px bg-border" />
      {toolButton("pointer", "Pointer (V)", MousePointer2)}
      {toolButton("pan", "Pan", Move)}
      {toolButton("brush", "Brush (B)", PencilLine)}
      {toolButton("delete", "Delete ROI (E)", Eraser)}
      {toolButton("select-click", "Click-select ROIs to delete", MousePointerClick)}
      {toolButton("select-region", "Region-select ROIs to delete (double-click to close)", Lasso)}
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="icon-xs" variant="ghost">
        <ZoomOut />
      </Button>
      <Button size="icon-xs" variant="ghost">
        <ZoomIn />
      </Button>
      <Button size="icon-xs" variant="ghost">
        <Maximize2 />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="icon-xs" variant="ghost">
        <Settings2 />
      </Button>
      <div className="ms-auto flex items-center gap-3 text-muted-foreground text-xs">
        <span className="font-mono">
          {image ? `${image.width} × ${image.height} · ${image.dtype}` : "no image"}
        </span>
      </div>
    </div>
  );
}
