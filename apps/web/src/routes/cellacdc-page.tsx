import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  BadgeCheck,
  Brush,
  CircleOff,
  Eye,
  EyeOff,
  FolderOpen,
  GitBranch,
  Hand,
  HelpCircle,
  ImageIcon,
  Link2,
  ListChecks,
  Maximize2,
  MousePointer2,
  PanelRight,
  Play,
  Redo2,
  Save,
  Scissors,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Tags,
  Undo2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/menu";
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
import { Slider } from "@/components/ui/slider";
import { CanvasArea } from "@/components/canvas-area";
import { LoadPatternDialog } from "@/components/load-pattern-dialog";
import { SaveMenuItems } from "@/components/save-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWebSocket } from "@/hooks/use-websocket";
import { useFsStore } from "@/stores/fs-store";
import { useSessionStore } from "@/stores/session-store";
import {
  type CellacdcMode,
  type CellacdcTool,
  useToolStore,
} from "@/stores/tool-store";

const MODES: Array<{ value: CellacdcMode; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "segmentation-tracking", label: "Segmentation and Tracking" },
  { value: "cell-cycle", label: "Cell cycle analysis" },
  { value: "custom-annotations", label: "Custom annotations" },
];

const AXES = [
  { id: "position", label: "P" },
  { id: "time", label: "T" },
  { id: "channel", label: "C" },
  { id: "z", label: "Z" },
] as const;

function StatusDot({
  status,
}: {
  status: "connected" | "connecting" | "disconnected";
}) {
  const cls =
    status === "connected"
      ? "bg-emerald-400"
      : status === "connecting"
        ? "bg-amber-300"
        : "bg-red-400";
  return <span className={`size-1.5 rounded-full ${cls}`} />;
}

function MenuBar() {
  const { send } = useWebSocket();
  const openBrowser = useFsStore((s) => s.openBrowser);
  const autoloadMasks = useFsStore((s) => s.autoloadMasks);
  const setAutoloadMasks = useFsStore((s) => s.setAutoloadMasks);
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  const mode = useToolStore((s) => s.cellacdcMode);
  const setMode = useToolStore((s) => s.setCellacdcMode);
  const showMasks = useToolStore((s) => s.showMasks);
  const toggleMasks = useToolStore((s) => s.toggleMasks);
  const showOutlines = useToolStore((s) => s.showOutlines);
  const toggleOutlines = useToolStore((s) => s.toggleOutlines);
  const showLabels = useToolStore((s) => s.showLabels);
  const toggleLabels = useToolStore((s) => s.toggleLabels);
  const [patternOpen, setPatternOpen] = useState(false);
  const [patternFolder, setPatternFolder] = useState("");

  const loadFolderPattern = () => {
    openBrowser("dir", {
      onPick: (path) => {
        setPatternFolder(path);
        setPatternOpen(true);
        send({ type: "fs:suggest_series_templates", payload: { folder: path } });
      },
    });
  };

  return (
    <>
      <nav className="flex min-w-0 flex-wrap items-center gap-0.5 text-[11px]">
        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">File</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem onClick={() => openBrowser("image")}>
              Open image... <MenuShortcut>Ctrl+O</MenuShortcut>
            </MenuItem>
            <MenuItem onClick={loadFolderPattern}>Open position folder...</MenuItem>
            <MenuItem disabled>Open Cell-ACDC experiment...</MenuItem>
            <MenuCheckboxItem checked={autoloadMasks} onCheckedChange={setAutoloadMasks}>
              Autoload masks from sidecar files
            </MenuCheckboxItem>
            <MenuItem disabled={!image} onClick={() => openBrowser("mask")}>
              Load segmentation masks...
            </MenuItem>
            <MenuSeparator />
            <SaveMenuItems />
            <MenuItem disabled>Export Cell-ACDC output table...</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Edit</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem disabled={!mask?.canUndo} onClick={() => send({ type: "mask:undo" })}>
              Undo <MenuShortcut>Ctrl+Z</MenuShortcut>
            </MenuItem>
            <MenuItem disabled={!mask?.canRedo} onClick={() => send({ type: "mask:redo" })}>
              Redo <MenuShortcut>Ctrl+Y</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem disabled={!mask?.nRois} onClick={() => send({ type: "mask:clear" })}>
              Clear segmentation masks
            </MenuItem>
            <MenuItem disabled>Copy selected IDs to future frames</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">View</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuCheckboxItem checked={showMasks} onCheckedChange={toggleMasks}>Masks</MenuCheckboxItem>
            <MenuCheckboxItem checked={showOutlines} onCheckedChange={toggleOutlines}>Contours</MenuCheckboxItem>
            <MenuCheckboxItem checked={showLabels} onCheckedChange={toggleLabels}>Object IDs</MenuCheckboxItem>
            <MenuItem disabled>Detach right image window</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Image</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem disabled>Data preparation wizard...</MenuItem>
            <MenuItem disabled>Crop time or z range...</MenuItem>
            <MenuItem disabled>Register channels...</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Segment</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem onClick={() => send({ type: "model:list" })}>Refresh Cell-ACDC models</MenuItem>
            <MenuItem disabled={!image}>Run selected model from right panel</MenuItem>
            <MenuItem disabled>Open full segmentation parameters...</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Tracking</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem disabled={!image} onClick={() => send({ type: "cellacdc:track_frame", payload: {} })}>
              Track current frame from previous loaded frame
            </MenuItem>
            <MenuItem disabled={!image} onClick={() => send({ type: "cellacdc:track_series", payload: {} })}>
              Track loaded frame cache
            </MenuItem>
            <MenuItem disabled>Open tracker parameter dialog...</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Measurement</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem disabled>Measure features...</MenuItem>
            <MenuItem disabled>Open Cell-ACDC output table...</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Settings</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem disabled>Preferences...</MenuItem>
            <MenuItem disabled>Model installation manager...</MenuItem>
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Mode</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            {MODES.map((item) => (
              <MenuCheckboxItem
                checked={mode === item.value}
                key={item.value}
                onCheckedChange={() => setMode(item.value)}
              >
                {item.label}
              </MenuCheckboxItem>
            ))}
          </MenuPopup>
        </Menu>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost">Help</Button>} />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem onClick={() => window.open("https://cell-acdc.readthedocs.io/", "_blank")}>
              Cell-ACDC documentation
            </MenuItem>
            <MenuItem onClick={() => send({ type: "ping" })}>Send ping</MenuItem>
          </MenuPopup>
        </Menu>
      </nav>
      <LoadPatternDialog folder={patternFolder} open={patternOpen} onOpenChange={setPatternOpen} />
    </>
  );
}

function IconButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className={`rounded-sm ${active ? "bg-cyan-500/20 text-cyan-100" : "text-slate-200"}`}
      disabled={disabled}
      onClick={onClick}
      size="icon-xs"
      title={label}
      variant="ghost"
    >
      <Icon />
    </Button>
  );
}

function Toolbar() {
  const { send } = useWebSocket();
  const openBrowser = useFsStore((s) => s.openBrowser);
  const tool = useToolStore((s) => s.cellacdcTool);
  const setAcdcTool = useToolStore((s) => s.setCellacdcTool);
  const setTool = useToolStore((s) => s.setTool);
  const setZoom = useToolStore((s) => s.setZoom);
  const resetView = useToolStore((s) => s.resetView);
  const mask = useSessionStore((s) => s.mask);

  const selectTool = (value: CellacdcTool) => {
    setAcdcTool(value);
    if (value === "navigate") setTool("pan");
    if (value === "inspect") setTool("pointer");
    if (value === "paint") setTool("brush");
    if (value === "delete") setTool("delete");
  };

  return (
    <div className="flex min-w-0 items-center gap-1 border-slate-700 border-b bg-slate-900 px-2 py-1">
      <IconButton icon={FolderOpen} label="Open image" onClick={() => openBrowser("image")} />
      <IconButton icon={Save} label="Save masks" onClick={() => send({ type: "image:save_seg", payload: {} })} />
      <div className="mx-1 h-5 w-px bg-slate-700" />
      <IconButton disabled={!mask?.canUndo} icon={Undo2} label="Undo" onClick={() => send({ type: "mask:undo" })} />
      <IconButton disabled={!mask?.canRedo} icon={Redo2} label="Redo" onClick={() => send({ type: "mask:redo" })} />
      <div className="mx-1 h-5 w-px bg-slate-700" />
      <IconButton active={tool === "navigate"} icon={Hand} label="Navigate" onClick={() => selectTool("navigate")} />
      <IconButton active={tool === "inspect"} icon={MousePointer2} label="Inspect object" onClick={() => selectTool("inspect")} />
      <IconButton active={tool === "paint"} icon={Brush} label="Paint segmentation" onClick={() => selectTool("paint")} />
      <IconButton active={tool === "delete"} icon={Scissors} label="Delete object" onClick={() => selectTool("delete")} />
      <IconButton active={tool === "track"} icon={GitBranch} label="Track frame" onClick={() => {
        selectTool("track");
        send({ type: "cellacdc:track_frame", payload: {} });
      }} />
      <IconButton active={tool === "annotate"} icon={Tags} label="Annotate object" onClick={() => selectTool("annotate")} />
      <div className="mx-1 h-5 w-px bg-slate-700" />
      <IconButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))} />
      <IconButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom((z) => Math.min(20, z * 1.2))} />
      <IconButton icon={Maximize2} label="Fit view" onClick={resetView} />
      <div className="ml-auto flex items-center gap-1 text-slate-400 text-xs">
        <Settings2 className="size-3.5" />
        <span className="hidden sm:inline">Cell-ACDC correction workspace</span>
      </div>
    </div>
  );
}

function ModeSelector() {
  const mode = useToolStore((s) => s.cellacdcMode);
  const setMode = useToolStore((s) => s.setCellacdcMode);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 border-slate-800 border-b bg-slate-950 px-2 py-1">
      {MODES.map((item) => (
        <Button
          className={`h-6 rounded-sm px-2 text-[11px] ${mode === item.value ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"}`}
          key={item.value}
          onClick={() => setMode(item.value)}
          size="xs"
          variant="ghost"
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

function AxisControl({ id, label }: { id: string; label: string }) {
  const { send } = useWebSocket();
  const dataset = useSessionStore((s) => s.seriesDataset);
  const coords = useSessionStore((s) => s.seriesCoordinates);
  const setCoords = useSessionStore((s) => s.setSeriesCoordinates);
  const current = coords[id] ?? 0;
  const max = Math.max(0, (dataset?.axes[id] ?? 1) - 1);

  const setValue = (value: number) => {
    if (!dataset) return;
    const next = Math.max(0, Math.min(max, Math.round(value)));
    const nextCoords = { ...coords, [id]: next };
    setCoords(nextCoords);
    send({
      type: "image:open_series",
      payload: {
        folder: dataset.folder,
        subfolder_template: dataset.subfolder_template,
        filename_template: dataset.filename_template,
        position: nextCoords.position ?? 0,
        time: nextCoords.time ?? 0,
        channel: nextCoords.channel ?? 0,
        z: nextCoords.z ?? 0,
      },
    });
  };

  return (
    <div className="grid grid-cols-[1rem_1.5rem_1fr_1.5rem_2.5rem] items-center gap-1">
      <span className="font-mono text-slate-300 text-xs">{label}</span>
      <Button disabled={!dataset || current === 0} onClick={() => setValue(current - 1)} size="icon-xs" variant="outline">
        <SkipBack />
      </Button>
      <Slider
        className="min-w-0 [&_[data-slot=slider-control]]:min-w-0"
        disabled={!dataset || max === 0}
        max={max || 1}
        onValueCommitted={(v) => setValue(Array.isArray(v) ? v[0] : v)}
        onValueChange={(v) => setCoords({ ...coords, [id]: Array.isArray(v) ? v[0] : v })}
        value={current}
      />
      <Button disabled={!dataset || current === max} onClick={() => setValue(current + 1)} size="icon-xs" variant="outline">
        <SkipForward />
      </Button>
      <span className="text-right font-mono text-slate-400 text-xs">{current}/{max}</span>
    </div>
  );
}

function LeftControls() {
  const autoContrast = useToolStore((s) => s.autoContrast);
  const setAutoContrast = useToolStore((s) => s.setAutoContrast);
  const showMasks = useToolStore((s) => s.showMasks);
  const setShowMasks = useToolStore((s) => s.setShowMasks);
  const showOutlines = useToolStore((s) => s.showOutlines);
  const setShowOutlines = useToolStore((s) => s.setShowOutlines);
  const showLabels = useToolStore((s) => s.showLabels);
  const toggleLabels = useToolStore((s) => s.toggleLabels);
  const brushSize = useToolStore((s) => s.brushSize);
  const setBrushSize = useToolStore((s) => s.setBrushSize);
  const mask = useSessionStore((s) => s.mask);

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-slate-800 border-r bg-slate-950">
      <Panel title="Object IDs">
        <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
          <Metric label="ROIs" value={mask?.nRois ?? 0} />
          <Metric label="New" value="0" />
          <Metric label="Missing" value="0" />
        </div>
        <div className="max-h-36 overflow-y-auto border border-slate-800 bg-slate-900/60">
          {(mask?.rois ?? []).slice(0, 80).map((roi) => (
            <div className="flex items-center justify-between border-slate-800 border-b px-2 py-1 text-[11px]" key={roi.id}>
              <span className="font-mono text-slate-200">ID {roi.id}</span>
              <Badge size="sm" variant="outline">{roi.contours.length}</Badge>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Contrast and overlays">
        <CheckRow checked={autoContrast} label="Auto-contrast image" onCheckedChange={setAutoContrast} />
        <CheckRow checked={showMasks} label="Masks" onCheckedChange={setShowMasks} />
        <CheckRow checked={showOutlines} label="Contours" onCheckedChange={setShowOutlines} />
        <CheckRow checked={showLabels} label="Object IDs" onCheckedChange={() => toggleLabels()} />
        <Field label="Brush">
          <Select value={String(brushSize)} onValueChange={(v) => setBrushSize(Number(v))}>
            <SelectButton className="bg-slate-900" size="sm"><SelectValue /></SelectButton>
            <SelectContent>
              {[1, 3, 5, 7, 9, 13, 20].map((size) => (
                <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Panel>

      <Panel title="Frame controls">
        {AXES.map((axis) => (
          <AxisControl id={axis.id} key={axis.id} label={axis.label} />
        ))}
      </Panel>
    </aside>
  );
}

function RightControls() {
  const { send } = useWebSocket();
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  const models = useSessionStore((s) => s.models);
  const progress = useSessionStore((s) => s.progress);
  const params = useSessionStore((s) => s.params);
  const setParams = useSessionStore((s) => s.setParams);
  const annotations = useSessionStore((s) => s.cellacdcAnnotations);
  const showMissing = useToolStore((s) => s.showMissingCells);
  const showNew = useToolStore((s) => s.showNewCells);
  const showLinks = useToolStore((s) => s.showTrackingLinks);
  const toggleMissing = useToolStore((s) => s.toggleMissingCells);
  const toggleNew = useToolStore((s) => s.toggleNewCells);
  const toggleLinks = useToolStore((s) => s.toggleTrackingLinks);
  const [annotationId, setAnnotationId] = useState("1");

  const running = progress?.job === "run" && progress.progress < 1;
  const percent = progress ? Math.round(progress.progress * 100) : 0;
  const selectedModel = models.find((model) => model.name === params.model);

  const orderedModels = useMemo(() => {
    const preferred = ["Automatic thresholding", "cellpose_v4"];
    return [...models].sort((a, b) => {
      const ai = preferred.indexOf(a.name);
      const bi = preferred.indexOf(b.name);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.name.localeCompare(b.name);
    });
  }, [models]);

  const runSegmentation = () => {
    if (!image) return;
    send({
      type: "model:run",
      payload: {
        model: params.model,
        imagePath: image.path,
        useGpu: params.useGpu,
        segmentation: {
          diameter: params.diameter,
          flowThreshold: params.flowThreshold,
          cellprobThreshold: params.cellprobThreshold,
          niter: params.niter,
          minSize: params.minSize,
          anisotropy: params.anisotropy,
        },
      },
    });
  };

  const objectId = Number(annotationId);
  const canAnnotate = Number.isInteger(objectId) && objectId > 0;
  const setAnnotation = (annotation: "excluded" | "dead" | "unknownHistory") => {
    if (!canAnnotate) return;
    send({
      type: "cellacdc:annotation:set",
      payload: { objectId, annotation, value: true },
    });
  };

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-slate-800 border-l bg-slate-950">
      <Panel title="Segmentation model">
        <Field label="Model">
          <Select value={params.model} onValueChange={(v) => setParams({ model: v as string })}>
            <SelectButton className="bg-slate-900" size="sm"><SelectValue /></SelectButton>
            <SelectContent>
              {orderedModels.map((model) => (
                <SelectItem disabled={model.available === false} key={model.name} value={model.name}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {selectedModel?.unsupportedReason && (
          <p className="text-amber-200 text-[11px] leading-snug">{selectedModel.unsupportedReason}</p>
        )}
        <CheckRow checked={params.useGpu} label="Use GPU when available" onCheckedChange={(checked) => setParams({ useGpu: checked })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Diameter">
            <Input
              className="bg-slate-900"
              defaultValue={params.diameter ?? ""}
              onBlur={(event) => setParams({ diameter: event.currentTarget.value ? Number(event.currentTarget.value) : null })}
              placeholder="auto"
              size="sm"
            />
          </Field>
          <Field label="Min size">
            <Input className="bg-slate-900" defaultValue={params.minSize} onBlur={(event) => setParams({ minSize: Number(event.currentTarget.value) })} size="sm" />
          </Field>
        </div>
        <Button disabled={!image || running || selectedModel?.available === false} loading={running} onClick={runSegmentation} size="sm">
          <WandSparkles />
          Run {params.model}
        </Button>
        <Progress max={100} value={percent}>
          <div className="flex items-center justify-between">
            <ProgressLabel className="text-[11px]">
              {running ? progress?.message || "segmenting" : `${mask?.nRois ?? 0} objects`}
            </ProgressLabel>
            <ProgressValue className="text-slate-400 text-[11px]" />
          </div>
          <ProgressTrack><ProgressIndicator /></ProgressTrack>
        </Progress>
      </Panel>

      <Panel title="Tracking">
        <div className="grid grid-cols-2 gap-1.5">
          <Button disabled={!image} onClick={() => send({ type: "cellacdc:track_frame", payload: {} })} size="xs" variant="outline">
            <GitBranch />
            Frame
          </Button>
          <Button disabled={!image} onClick={() => send({ type: "cellacdc:track_series", payload: {} })} size="xs" variant="outline">
            <Play />
            Series
          </Button>
        </div>
        <CheckRow checked={showMissing} label="Missing-cell overlay" onCheckedChange={() => toggleMissing()} />
        <CheckRow checked={showNew} label="New-cell overlay" onCheckedChange={() => toggleNew()} />
        <CheckRow checked={showLinks} label="Tracking links" onCheckedChange={() => toggleLinks()} />
        <Button disabled size="xs" variant="outline">Full tracker parameters...</Button>
      </Panel>

      <Panel title="Annotations">
        <Field label="Object ID">
          <Input className="bg-slate-900 font-mono" onChange={(event) => setAnnotationId(event.currentTarget.value)} size="sm" value={annotationId} />
        </Field>
        <div className="grid grid-cols-3 gap-1">
          <Button disabled={!canAnnotate} onClick={() => setAnnotation("excluded")} size="xs" variant="outline">Excluded</Button>
          <Button disabled={!canAnnotate} onClick={() => setAnnotation("dead")} size="xs" variant="outline">Dead</Button>
          <Button disabled={!canAnnotate} onClick={() => setAnnotation("unknownHistory")} size="xs" variant="outline">Unknown</Button>
        </div>
        <Button disabled={!canAnnotate} onClick={() => send({ type: "cellacdc:annotation:clear", payload: { objectId } })} size="xs" variant="outline">
          Clear object annotation
        </Button>
        <div className="max-h-32 overflow-y-auto border border-slate-800 bg-slate-900/50">
          {Object.entries(annotations).length === 0 ? (
            <div className="px-2 py-1.5 text-slate-500 text-[11px]">No annotations</div>
          ) : (
            Object.entries(annotations).map(([id, value]) => (
              <div className="flex items-center justify-between border-slate-800 border-b px-2 py-1 text-[11px]" key={id}>
                <span className="font-mono">ID {id}</span>
                <span className="truncate text-slate-300">{Object.keys(value).join(", ")}</span>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="Right image controls">
        <Field label="Projection">
          <ProjectionSelect />
        </Field>
        <Button disabled size="xs" variant="outline">Measurement table...</Button>
      </Panel>
    </aside>
  );
}

function ProjectionSelect() {
  const projection = useToolStore((s) => s.projection);
  const setProjection = useToolStore((s) => s.setProjection);
  return (
    <Select value={projection} onValueChange={(value) => setProjection(value as "single" | "max" | "mean")}>
      <SelectButton className="bg-slate-900" size="sm"><SelectValue /></SelectButton>
      <SelectContent>
        <SelectItem value="single">Single plane</SelectItem>
        <SelectItem value="max">Max projection</SelectItem>
        <SelectItem value="mean">Mean projection</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ViewerPane({ title, right }: { title: string; right?: boolean }) {
  const image = useSessionStore((s) => s.image);
  const showMissing = useToolStore((s) => s.showMissingCells);
  const showNew = useToolStore((s) => s.showNewCells);
  const showLinks = useToolStore((s) => s.showTrackingLinks);

  return (
    <section className="relative min-h-[18rem] min-w-0 overflow-hidden border border-slate-800 bg-black">
      <div className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between border-slate-800 border-b bg-slate-950/90 px-2 py-1 text-[11px] text-slate-300">
        <span className="flex items-center gap-1.5">
          {right ? <PanelRight className="size-3.5" /> : <ImageIcon className="size-3.5" />}
          {title}
        </span>
        <span className="truncate font-mono text-slate-500">{image?.path.split(/[\\/]/).pop() ?? "no image"}</span>
      </div>
      <div className="absolute inset-0 pt-6">
        <CanvasArea />
      </div>
      <div className="pointer-events-none absolute top-8 left-2 z-20 flex gap-1 text-[10px]">
        {showMissing && <span className="border border-red-400/40 bg-red-500/15 px-1 text-red-100">missing IDs</span>}
        {showNew && <span className="border border-emerald-400/40 bg-emerald-500/15 px-1 text-emerald-100">new cells</span>}
        {showLinks && <span className="border border-cyan-400/40 bg-cyan-500/15 px-1 text-cyan-100">tracks</span>}
      </div>
    </section>
  );
}

function BottomControls() {
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  return (
    <div className="grid gap-2 border-slate-800 border-t bg-slate-950 px-2 py-2 text-[11px] lg:grid-cols-[1fr_auto]">
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
        {AXES.map((axis) => (
          <AxisControl id={axis.id} key={axis.id} label={axis.label} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 text-slate-400">
        <span>{image ? `${image.width}x${image.height} ${image.dtype}` : "no image"}</span>
        <span>{mask?.nRois ?? 0} objects</span>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-slate-800 border-b p-2">
      <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-[11px] text-slate-300 uppercase tracking-wide">
        <ListChecks className="size-3.5 text-cyan-300" />
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-[11px] text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CheckRow({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <span>{label}</span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border border-slate-800 bg-slate-900 px-1.5 py-1">
      <div className="font-mono text-slate-100">{value}</div>
      <div className="text-slate-500">{label}</div>
    </div>
  );
}

export function CellacdcPage() {
  const { status } = useWebSocket();
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 lg:h-screen">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-slate-800 border-b bg-slate-900 px-2 py-1">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 pr-2 text-[12px] font-semibold">
            <BadgeCheck className="size-4 text-cyan-300" />
            <span>Cell-ACDC</span>
          </div>
          <a className="text-slate-400 text-[11px] hover:text-slate-100" href="/cellpose">Cellpose</a>
          <MenuBar />
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-slate-700 bg-slate-950 text-slate-200" variant="outline">
            <StatusDot status={status} />
            {status}
          </Badge>
          <ThemeToggle />
        </div>
      </header>

      <Toolbar />
      <ModeSelector />

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        <LeftControls />
        <div className="flex min-h-0 min-w-0 flex-col bg-slate-950">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-1 p-1 xl:grid-cols-2">
            <ViewerPane title="Left image" />
            <ViewerPane right title="Right image" />
          </div>
          <BottomControls />
        </div>
        <RightControls />
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-slate-800 border-t bg-slate-900 px-2 py-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          {image ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {image?.path ?? "No image loaded"}
        </span>
        <span className="flex items-center gap-3">
          <span>{mask?.nRois ?? 0} objects</span>
          <span className="flex items-center gap-1"><Link2 className="size-3.5" /> sidecar annotations</span>
          <span className="flex items-center gap-1"><HelpCircle className="size-3.5" /> Qt-only workflows disabled</span>
          <span className="flex items-center gap-1"><Search className="size-3.5" /> v1 web port</span>
          <span className="flex items-center gap-1"><CircleOff className="size-3.5" /> measurements off</span>
        </span>
      </footer>
    </div>
  );
}
