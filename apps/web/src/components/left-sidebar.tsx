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

const AXES = [
  { key: "P", label: "Position" },
  { key: "T", label: "Time" },
  { key: "C", label: "Channel" },
  { key: "Z", label: "Z-plane" },
] as const;

function AxisControl({ axisKey, label }: { axisKey: string; label: string }) {
  const [value, setValue] = useState(0);
  return (
    <div className="grid grid-cols-[1.25rem_1.5rem_1fr_1.5rem_2.5rem] items-center gap-1.5">
      <span
        className="font-mono font-semibold text-foreground text-xs"
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
      <span className="text-right text-muted-foreground text-xs tabular-nums">
        {value}/100
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
      <Slider defaultValue={defaultRange} max={255} min={0}>
        <SliderPrimitive.Value className="sr-only" />
      </Slider>
    </div>
  );
}

export function LeftSidebar() {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-border border-r bg-background/50 p-3">
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

      <SidebarSection title="Drawing">
        <FieldRow label="Brush size">
          <Select defaultValue="3">
            <SelectButton size="sm">
              <SelectValue />
            </SelectButton>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="7">7</SelectItem>
              <SelectItem value="9">9</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox defaultChecked />
          <span className="font-medium uppercase">Masks on [X]</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox />
          <span>outlines on [Z]</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox defaultChecked />
          <span>single stroke</span>
        </label>
        <div className="rounded-md border border-dashed bg-muted/30 p-2">
          <p className="mb-2 text-muted-foreground text-[10px] uppercase tracking-wide">
            Delete multiple ROIs
          </p>
          <div className="flex flex-col gap-1.5">
            <Button size="xs" variant="outline">
              region-select
            </Button>
            <Button size="xs" variant="outline">
              click-select
            </Button>
            <div className="flex gap-1.5">
              <Button className="flex-1" size="xs" variant="secondary">
                done
              </Button>
              <Button className="flex-1" size="xs" variant="outline">
                cancel
              </Button>
            </div>
          </div>
        </div>
      </SidebarSection>
    </aside>
  );
}
