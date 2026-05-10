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
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  const runSegmentation = () => {
    setRunning(true);
    setProgress(0);
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          window.clearInterval(id);
          setRunning(false);
          return 100;
        }
        return p + 8;
      });
    }, 120);
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-border border-l bg-background/50 p-3">
      <SidebarSection title="Segmentation">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox defaultChecked />
          <Cpu className="size-3 text-muted-foreground" />
          <span>use GPU</span>
        </label>
        <Button
          className="w-full"
          loading={running}
          onClick={runSegmentation}
          size="sm"
        >
          <Sparkles />
          run CPSAM
        </Button>
        <Progress max={100} value={progress}>
          <div className="flex items-center justify-between">
            <ProgressLabel className="text-xs">
              {running ? "segmenting…" : "0 ROIs"}
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
              size="sm"
              defaultValue="30"
              placeholder="auto"
            />
          </FieldRow>
          <FieldRow label="flow_thresh">
            <Input size="sm" defaultValue="0.4" />
          </FieldRow>
          <FieldRow label="cellprob_thresh">
            <Input size="sm" defaultValue="0.0" />
          </FieldRow>
          <FieldRow label="niter">
            <Input size="sm" defaultValue="0" />
          </FieldRow>
          <FieldRow label="min_size">
            <Input size="sm" defaultValue="15" />
          </FieldRow>
          <FieldRow label="anisotropy">
            <Input size="sm" defaultValue="1.0" />
          </FieldRow>
        </Collapsible>
      </SidebarSection>

      <SidebarSection title="User-trained models">
        <div className="flex gap-1.5">
          <Select defaultValue="custom">
            <SelectButton className="flex-1" size="sm">
              <SelectValue />
            </SelectButton>
            <SelectContent>
              <SelectItem value="custom">custom models</SelectItem>
              <SelectItem value="cyto3">cyto3</SelectItem>
              <SelectItem value="nuclei">nuclei</SelectItem>
              <SelectItem value="tissuenet">tissuenet</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline">
            <Play />
            run
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Train your own models in the{" "}
          <Badge size="sm" variant="outline">
            Models
          </Badge>{" "}
          menu, then choose them here.
        </p>
      </SidebarSection>

      <SidebarSection title="Image filtering">
        <div className="flex gap-1.5">
          <Button className="flex-1" size="sm" variant="outline">
            none
          </Button>
          <Button className="flex-1" size="sm" variant="outline">
            filter
          </Button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox defaultChecked />
          <span>save restored/filtered image</span>
        </label>

        <Collapsible title="custom filter settings">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "sharpen radius", value: "0" },
              { label: "smooth radius", value: "0" },
              { label: "tile_norm size", value: "0" },
              { label: "tile smooth3D", value: "0" },
            ].map((f) => (
              <div className="flex flex-col gap-1" key={f.label}>
                <label className="text-muted-foreground text-[10px]">
                  {f.label}
                </label>
                <Input defaultValue={f.value} size="sm" />
              </div>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox defaultChecked />
            <span>norm3D</span>
          </label>
        </Collapsible>
      </SidebarSection>
    </aside>
  );
}
