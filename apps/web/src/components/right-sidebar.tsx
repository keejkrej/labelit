import { useState } from "react";
import { ChevronDown, ChevronRight, Cpu, Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";
import {
  Select,
  SelectButton,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow, SidebarSection } from "@/components/sidebar-section";
import { TrainDialog } from "@/components/train-dialog";
import { useWebSocket } from "@/hooks/use-websocket";
import { useSessionStore } from "@/stores/session-store";

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border bg-muted/20">
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-1.5 text-left text-foreground text-xs hover:bg-accent/40"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        <span className="font-medium">{title}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t p-2.5">{children}</div>
      )}
    </div>
  );
}

export function RightSidebar() {
  const { send } = useWebSocket();
  const [trainOpen, setTrainOpen] = useState(false);
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  const models = useSessionStore((s) => s.models);
  const progress = useSessionStore((s) => s.progress);
  const params = useSessionStore((s) => s.params);
  const setParams = useSessionStore((s) => s.setParams);
  const nRois = mask?.nRois ?? 0;

  const running =
    progress != null && progress.progress < 1 && progress.job === "run";
  const training =
    progress != null && progress.progress < 1 && progress.job === "train";
  const percent = progress ? Math.round(progress.progress * 100) : 0;

  const runSegmentation = () => {
    if (!image) return;
    send({
      type: "model:run",
      payload: {
        model: params.model,
        imagePath: image.path,
        diameter: params.diameter,
        flowThreshold: params.flowThreshold,
        cellprobThreshold: params.cellprobThreshold,
        niter: params.niter,
        minSize: params.minSize,
        anisotropy: params.anisotropy,
        useGpu: params.useGpu,
      },
    });
  };

  const builtins = models.filter((m) => m.source === "builtin");
  const customs = models.filter((m) => m.source === "custom");

  return (
    <aside className="relative z-10 flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-border/50 border-l bg-background/40 backdrop-blur-xl p-3 shadow-sm transition-all duration-300">
      <SidebarSection title="Segmentation">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={params.useGpu}
            onCheckedChange={(c) => setParams({ useGpu: c === true })}
          />
          <Cpu className="size-3 text-muted-foreground" />
          <span>use GPU</span>
        </label>
        <FieldRow label="model">
          <Select
            value={params.model}
            onValueChange={(v) => setParams({ model: v as string })}
          >
            <SelectButton size="sm">
              <SelectValue />
            </SelectButton>
            <SelectContent>
              {builtins.map((m) => (
                <SelectItem key={m.name} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
              {customs.length > 0 && (
                <>
                  <div className="my-1 h-px bg-border" />
                  {customs.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}{" "}
                      <span className="text-muted-foreground text-[10px]">
                        (custom)
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </FieldRow>
        <Button
          className="w-full"
          disabled={!image || running || training}
          loading={running}
          onClick={runSegmentation}
          size="sm"
        >
          <Sparkles />
          run {params.model}
        </Button>
        <Progress max={100} value={percent}>
          <div className="flex items-center justify-between">
            <ProgressLabel className="text-xs">
              {running
                ? progress?.message || "segmenting…"
                : training
                  ? progress?.message || "training…"
                  : `${nRois} ROIs`}
            </ProgressLabel>
            <ProgressValue className="text-muted-foreground text-xs" />
          </div>
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>

        <Collapsible title="additional settings">
          <FieldRow label="diameter">
            <Input
              defaultValue={params.diameter ?? ""}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                setParams({ diameter: v === "" ? null : Number(v) });
              }}
              placeholder="auto"
              size="sm"
            />
          </FieldRow>
          <FieldRow label="flow_thresh">
            <Input
              defaultValue={params.flowThreshold}
              onBlur={(e) =>
                setParams({ flowThreshold: Number(e.currentTarget.value) })
              }
              size="sm"
            />
          </FieldRow>
          <FieldRow label="cellprob_thresh">
            <Input
              defaultValue={params.cellprobThreshold}
              onBlur={(e) =>
                setParams({ cellprobThreshold: Number(e.currentTarget.value) })
              }
              size="sm"
            />
          </FieldRow>
          <FieldRow label="niter">
            <Input
              defaultValue={params.niter}
              onBlur={(e) =>
                setParams({ niter: Number(e.currentTarget.value) })
              }
              size="sm"
            />
          </FieldRow>
          <FieldRow label="min_size">
            <Input
              defaultValue={params.minSize}
              onBlur={(e) =>
                setParams({ minSize: Number(e.currentTarget.value) })
              }
              size="sm"
            />
          </FieldRow>
          <FieldRow label="anisotropy">
            <Input
              defaultValue={params.anisotropy}
              onBlur={(e) =>
                setParams({ anisotropy: Number(e.currentTarget.value) })
              }
              size="sm"
            />
          </FieldRow>
        </Collapsible>
      </SidebarSection>

      <SidebarSection title="User-trained models">
        {customs.length === 0 ? (
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            None yet. Train one on image+masks pairs in a folder.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {customs.map((m) => (
              <div
                className="flex items-center justify-between gap-1.5 rounded-md border bg-card px-2 py-1 text-xs"
                key={m.name}
              >
                <span className="truncate font-mono">{m.name}</span>
                <Button
                  disabled={!image || running || training}
                  onClick={() => {
                    setParams({ model: m.name });
                    runSegmentation();
                  }}
                  size="xs"
                  variant="outline"
                >
                  <Play />
                  run
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          disabled={training}
          onClick={() => setTrainOpen(true)}
          size="sm"
          variant="outline"
        >
          train new model…
        </Button>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Training runs server-side. Pick a folder of <Badge size="sm" variant="outline">image + image_masks</Badge> pairs.
        </p>
      </SidebarSection>

      <TrainDialog open={trainOpen} onOpenChange={setTrainOpen} />
    </aside>
  );
}
