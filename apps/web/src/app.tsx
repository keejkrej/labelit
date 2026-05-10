import { useWebSocket } from "./hooks/use-websocket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import {
  FileText,
  FolderOpen,
  Maximize2,
  MousePointer2,
  Move,
  PencilLine,
  Save,
  Settings2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const MENUS = ["File", "Edit", "Models", "Help"] as const;

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
  const { status } = useWebSocket();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Title bar / menu */}
      <header className="flex items-center justify-between border-border border-b bg-card/60 px-3 py-1.5">
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
          <nav className="flex items-center gap-0.5">
            {MENUS.map((m) => (
              <Button key={m} size="xs" variant="ghost">
                {m}
              </Button>
            ))}
          </nav>
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

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-border border-b bg-background px-3 py-1.5">
        <Button size="xs" variant="ghost">
          <FolderOpen />
          open image
        </Button>
        <Button size="xs" variant="ghost">
          <FileText />
          open mask
        </Button>
        <Button size="xs" variant="ghost">
          <Save />
          save
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button size="icon-xs" variant="ghost">
          <MousePointer2 />
        </Button>
        <Button size="icon-xs" variant="ghost">
          <Move />
        </Button>
        <Button size="icon-xs" variant="ghost">
          <PencilLine />
        </Button>
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
          <span className="font-mono">1024 × 1024 · 16-bit</span>
          <span className="font-mono">x: 512  y: 387</span>
          <span className="font-mono">val: 142</span>
        </div>
      </div>

      {/* Main 3-pane area */}
      <main className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CanvasArea />
        <RightSidebar />
      </main>

      {/* Status bar */}
      <footer className="flex items-center justify-between border-border border-t bg-card/60 px-3 py-1 text-muted-foreground text-xs">
        <span>cellpose v4.0 · cpsam model · GPU: NVIDIA RTX 4090</span>
        <span>0 ROIs · diameter: auto · cellprob: 0.0 · flow: 0.4</span>
      </footer>
    </div>
  );
}

function CanvasArea() {
  return (
    <div className="relative flex flex-1 flex-col bg-[oklch(0.18_0_0)] dark:bg-[oklch(0.12_0_0)]">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative aspect-square w-[min(80%,42rem)] overflow-hidden rounded-md border border-white/10 bg-[oklch(0.22_0_0)] shadow-2xl"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 40%, oklch(0.55 0.18 270 / 0.55), transparent 30%), radial-gradient(circle at 70% 60%, oklch(0.6 0.18 25 / 0.45), transparent 35%), radial-gradient(circle at 50% 80%, oklch(0.65 0.18 140 / 0.4), transparent 30%), radial-gradient(circle at 80% 20%, oklch(0.6 0.2 200 / 0.4), transparent 30%)",
          }}
        >
          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Crosshair */}
          <div className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 size-10 rounded-full ring-2 ring-amber-300/70" />
          {/* Mock detected cells (ROI outlines) */}
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full"
            viewBox="0 0 100 100"
          >
            <g
              fill="none"
              stroke="oklch(0.85 0.18 75)"
              strokeWidth="0.3"
              strokeOpacity="0.85"
            >
              <ellipse cx="22" cy="30" rx="6" ry="5" />
              <ellipse cx="42" cy="22" rx="5" ry="6" />
              <ellipse cx="64" cy="34" rx="7" ry="5" />
              <ellipse cx="78" cy="20" rx="4" ry="4" />
              <ellipse cx="30" cy="55" rx="5" ry="5" />
              <ellipse cx="52" cy="58" rx="6" ry="6" />
              <ellipse cx="74" cy="62" rx="5" ry="4" />
              <ellipse cx="20" cy="78" rx="6" ry="5" />
              <ellipse cx="44" cy="82" rx="5" ry="5" />
              <ellipse cx="68" cy="84" rx="6" ry="6" />
              <ellipse cx="86" cy="74" rx="4" ry="5" />
            </g>
          </svg>
        </div>
      </div>

      {/* Floating canvas label */}
      <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-sm">
        sample_001.tif · Z 12/40 · T 1/1
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-sm">
        100% · pan/zoom: drag · brush: 3px
      </div>
    </div>
  );
}
