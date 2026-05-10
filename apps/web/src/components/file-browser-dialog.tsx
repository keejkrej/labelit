import { useEffect, useMemo } from "react";
import {
  ArrowUp,
  ChevronRight,
  File as FileIcon,
  Folder,
  HardDrive,
  Home,
  Loader2,
} from "lucide-react";
import type { FsEntry } from "@labelit/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  IMAGE_PATTERNS,
  MASK_PATTERNS,
  useFsStore,
} from "@/stores/fs-store";
import { useSessionStore } from "@/stores/session-store";
import { cn } from "@/lib/utils";

type BrowserMode = "image" | "mask" | "save" | "dir";

function patternsForMode(mode: BrowserMode): string[] | undefined {
  if (mode === "image") return IMAGE_PATTERNS;
  if (mode === "mask") return MASK_PATTERNS;
  return undefined;
}

function titleForMode(mode: BrowserMode): string {
  if (mode === "image") return "Open image";
  if (mode === "mask") return "Open masks";
  if (mode === "dir") return "Choose folder";
  return "Save…";
}

function Breadcrumb({ path, onJump }: { path: string; onJump: (p: string) => void }) {
  const segments = useMemo(() => splitPath(path), [path]);
  return (
    <div className="flex flex-wrap items-center gap-0.5 overflow-hidden font-mono text-muted-foreground text-xs">
      {segments.map((seg, i) => (
        <span className="flex items-center" key={seg.path}>
          {i > 0 && <ChevronRight className="size-3 shrink-0" />}
          <button
            className="rounded px-1 py-0.5 hover:bg-accent hover:text-foreground"
            onClick={() => onJump(seg.path)}
            type="button"
          >
            {seg.label}
          </button>
        </span>
      ))}
    </div>
  );
}

function splitPath(path: string): { label: string; path: string }[] {
  if (!path) return [];
  // Windows: "C:\foo\bar" → ["C:\", "C:\foo", "C:\foo\bar"]
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    const norm = path.replace(/\//g, "\\");
    const parts = norm.split("\\").filter(Boolean);
    const out: { label: string; path: string }[] = [];
    let cur = parts[0] + "\\";
    out.push({ label: parts[0], path: cur });
    for (let i = 1; i < parts.length; i++) {
      cur = cur.endsWith("\\") ? cur + parts[i] : cur + "\\" + parts[i];
      out.push({ label: parts[i], path: cur });
    }
    return out;
  }
  // POSIX
  const parts = path.split("/").filter(Boolean);
  const out: { label: string; path: string }[] = [{ label: "/", path: "/" }];
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    out.push({ label: p, path: cur });
  }
  return out;
}

function EntryRow({
  entry,
  selected,
  onSelect,
  onActivate,
}: {
  entry: FsEntry;
  selected: boolean;
  onSelect: (e: FsEntry) => void;
  onActivate: (e: FsEntry) => void;
}) {
  const Icon = entry.kind === "drive" ? HardDrive : entry.kind === "dir" ? Folder : FileIcon;
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
        "hover:bg-accent",
        selected && "bg-accent text-accent-foreground",
      )}
      onClick={() => onSelect(entry)}
      onDoubleClick={() => onActivate(entry)}
      type="button"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-mono">{entry.name}</span>
      {entry.kind === "file" && entry.size != null && (
        <span className="ms-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {formatSize(entry.size)}
        </span>
      )}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function FileBrowserDialog() {
  const { send } = useWebSocket();
  const {
    open,
    mode,
    view,
    home,
    loading,
    error,
    selected,
    closeBrowser,
    setLoading,
    setSelected,
  } = useFsStore();

  // When the dialog opens, ask the server for drive roots.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    send({ type: "fs:list_roots" });
  }, [open, send, setLoading]);

  const listDir = (path: string) => {
    setLoading(true);
    send({
      type: "fs:list_dir",
      payload: { path, patterns: patternsForMode(mode) },
    });
  };

  const goUp = () => {
    if (view.kind === "dir") {
      if (view.data.parent) listDir(view.data.parent);
      else {
        setLoading(true);
        send({ type: "fs:list_roots" });
      }
    }
  };

  const goHome = () => {
    if (home) listDir(home);
  };

  const currentImagePath = useSessionStore((s) => s.image?.path ?? null);
  const onPick = useFsStore((s) => s.onPick);

  const activate = (entry: FsEntry) => {
    if (entry.kind === "drive" || entry.kind === "dir") {
      listDir(entry.path);
      return;
    }
    // File → emit an open message based on mode.
    if (mode === "image") {
      send({ type: "image:open", payload: { path: entry.path } });
    } else if (mode === "mask") {
      if (!currentImagePath) {
        useFsStore.getState().setError("Open an image before loading masks.");
        return;
      }
      send({
        type: "image:open_masks",
        payload: { path: entry.path, imagePath: currentImagePath },
      });
    } else if (mode === "save") {
      send({ type: "image:save_seg", payload: { path: entry.path } });
    }
    closeBrowser();
  };

  const confirmSelection = () => {
    if (mode === "dir") {
      // Picking a folder: prefer the selected dir, else the current folder.
      const chosen =
        selected?.kind === "dir" || selected?.kind === "drive"
          ? selected.path
          : view.kind === "dir"
            ? view.data.path
            : null;
      if (chosen && onPick) onPick(chosen);
      closeBrowser();
      return;
    }
    if (selected) activate(selected);
  };

  const entries: FsEntry[] =
    view.kind === "roots" ? view.data?.roots ?? [] : view.data.entries;
  const currentPath = view.kind === "dir" ? view.data.path : "";
  const upDisabled = view.kind === "roots";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : closeBrowser())}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup
            className="row-start-2 flex max-h-[80vh] w-full max-w-2xl flex-col gap-3 p-4"
            showCloseButton={false}
          >
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base">{titleForMode(mode)}</DialogTitle>
              <Button onClick={closeBrowser} size="xs" variant="ghost">
                close
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                aria-label="Up"
                disabled={upDisabled}
                onClick={goUp}
                size="icon-sm"
                variant="outline"
              >
                <ArrowUp />
              </Button>
              <Button
                aria-label="Home"
                disabled={!home}
                onClick={goHome}
                size="icon-sm"
                variant="outline"
              >
                <Home />
              </Button>
              <div className="min-w-0 flex-1 overflow-hidden rounded-md border bg-muted/30 px-2 py-1.5">
                {view.kind === "roots" ? (
                  <span className="font-mono text-muted-foreground text-xs">
                    drives
                  </span>
                ) : (
                  <Breadcrumb onJump={listDir} path={currentPath} />
                )}
              </div>
            </div>

            <ScrollArea className="min-h-[16rem] flex-1 rounded-md border">
              {error && (
                <div className="p-3 text-destructive-foreground text-xs">{error}</div>
              )}
              {loading && !entries.length && (
                <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground text-xs">
                  <Loader2 className="size-3 animate-spin" />
                  loading…
                </div>
              )}
              {!loading && !entries.length && !error && (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  empty
                </div>
              )}
              <div className="flex flex-col gap-0.5 p-1">
                {entries.map((entry) => (
                  <EntryRow
                    entry={entry}
                    key={entry.path}
                    onActivate={activate}
                    onSelect={setSelected}
                    selected={selected?.path === entry.path}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-muted-foreground text-xs">
                {selected?.path ?? (mode === "dir" && view.kind === "dir" ? view.data.path : "")}
              </span>
              <div className="flex gap-1.5">
                <Button onClick={closeBrowser} size="sm" variant="outline">
                  cancel
                </Button>
                <Button
                  disabled={
                    mode === "dir"
                      ? view.kind !== "dir" &&
                        !(selected?.kind === "dir" || selected?.kind === "drive")
                      : !selected ||
                        (mode !== "save" && selected.kind !== "file")
                  }
                  onClick={confirmSelection}
                  size="sm"
                >
                  {mode === "dir" ? "choose" : "open"}
                </Button>
              </div>
            </div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
