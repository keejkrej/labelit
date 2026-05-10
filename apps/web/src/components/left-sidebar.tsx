import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider, SliderPrimitive } from "@/components/ui/slider";
import {
  Select,
  SelectButton,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow, SidebarSection } from "@/components/sidebar-section";
import { useWebSocket } from "@/hooks/use-websocket";
import { useSessionStore } from "@/stores/session-store";
import { useToolStore } from "@/stores/tool-store";

const AXES = [
  { key: "P", label: "Position" },
  { key: "T", label: "Time" },
  { key: "C", label: "Channel" },
  { key: "Z", label: "Z-plane" },
] as const;

function AxisControl({ axisKey, label }: { axisKey: string; label: string }) {
  const [value, setValue] = useState(0);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        className="w-4 shrink-0 font-mono font-semibold text-foreground text-xs"
        title={label}
      >
        {axisKey}
      </span>
      <Button
        aria-label={`Previous ${label}`}
        onClick={() => setValue((v) => Math.max(0, v - 1))}
        size="icon-xs"
        variant="outline"
      >
        <ChevronLeft />
      </Button>
      <Slider
        className="min-w-0 flex-1 [&_[data-slot=slider-control]]:min-w-0"
        max={100}
        onValueChange={(v) => setValue(Array.isArray(v) ? v[0] : v)}
        value={value}
      />
      <Button
        aria-label={`Next ${label}`}
        onClick={() => setValue((v) => Math.min(100, v + 1))}
        size="icon-xs"
        variant="outline"
      >
        <ChevronRight />
      </Button>
      <span className="w-10 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
        {value}
      </span>
    </div>
  );
}

function ColorChannelSlider({
  label,
  color,
  defaultRange = [0, 255],
}: {
  label: string;
  color: string;
  defaultRange?: [number, number];
}) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
      <span
        className="font-medium text-xs"
        style={{ color }}
      >
        {label}
      </span>
      <Slider
        className="min-w-0 [&_[data-slot=slider-control]]:min-w-0"
        defaultValue={defaultRange}
        max={255}
        min={0}
      >
        <SliderPrimitive.Value className="sr-only" />
      </Slider>
    </div>
  );
}

export function LeftSidebar() {
  return (
    <aside className="relative z-10 flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-border/50 border-r bg-background/40 backdrop-blur-xl p-3 shadow-sm transition-all duration-300">
      <SidebarSection title="Navigation">
        {AXES.map((axis) => (
          <AxisControl
            axisKey={axis.key}
            key={axis.key}
            label={axis.label}
          />
        ))}
      </SidebarSection>

      <SidebarSection title="Views">
        <FieldRow label="Color">
          <Select defaultValue="rgb">
            <SelectButton size="sm">
              <SelectValue />
            </SelectButton>
            <SelectContent>
              <SelectItem value="rgb">RGB</SelectItem>
              <SelectItem value="red">red = R</SelectItem>
              <SelectItem value="green">green = G</SelectItem>
              <SelectItem value="blue">blue = B</SelectItem>
              <SelectItem value="gray">gray</SelectItem>
              <SelectItem value="spectral">spectral</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="View" hint="(pgUp/pgDn)">
          <Select defaultValue="image">
            <SelectButton size="sm">
              <SelectValue />
            </SelectButton>
            <SelectContent>
              <SelectItem value="image">image</SelectItem>
              <SelectItem value="gradxy">gradXY</SelectItem>
              <SelectItem value="cellprob">cellprob</SelectItem>
              <SelectItem disabled value="restored">
                restored
              </SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox defaultChecked />
          <span>auto-adjust saturation</span>
        </label>
        <div className="flex flex-col gap-2 border-t pt-2">
          <ColorChannelSlider color="#ef4444" label="red" />
          <ColorChannelSlider color="#84cc16" label="green" />
          <ColorChannelSlider color="#3b82f6" label="blue" />
        </div>
      </SidebarSection>

      <DrawingSection />
    </aside>
  );
}

function DrawingSection() {
  const { send } = useWebSocket();
  const mask = useSessionStore((s) => s.mask);
  const brushSize = useToolStore((s) => s.brushSize);
  const setBrushSize = useToolStore((s) => s.setBrushSize);
  const showMasks = useToolStore((s) => s.showMasks);
  const toggleMasks = useToolStore((s) => s.toggleMasks);
  const showOutlines = useToolStore((s) => s.showOutlines);
  const toggleOutlines = useToolStore((s) => s.toggleOutlines);

  return (
    <SidebarSection title="Drawing">
      <FieldRow label="Brush size">
        <Select
          value={String(brushSize)}
          onValueChange={(v) => setBrushSize(Number(v))}
        >
          <SelectButton size="sm">
            <SelectValue />
          </SelectButton>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="7">7</SelectItem>
            <SelectItem value="9">9</SelectItem>
            <SelectItem value="13">13</SelectItem>
            <SelectItem value="20">20</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <Checkbox checked={showMasks} onCheckedChange={() => toggleMasks()} />
        <span className="font-medium uppercase">Masks on [X]</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <Checkbox checked={showOutlines} onCheckedChange={() => toggleOutlines()} />
        <span>outlines on [Z]</span>
      </label>
      <div className="flex gap-1.5">
        <Button
          className="flex-1"
          disabled={!mask?.canUndo}
          onClick={() => send({ type: "mask:undo" })}
          size="xs"
          variant="outline"
        >
          undo [⌃Z]
        </Button>
        <Button
          className="flex-1"
          disabled={!mask?.canRedo}
          onClick={() => send({ type: "mask:redo" })}
          size="xs"
          variant="outline"
        >
          redo [⌃Y]
        </Button>
      </div>
      <Button
        disabled={!mask || mask.nRois === 0}
        onClick={() => send({ type: "mask:clear" })}
        size="xs"
        variant="outline"
      >
        clear all masks [⌃0]
      </Button>
    </SidebarSection>
  );
}
