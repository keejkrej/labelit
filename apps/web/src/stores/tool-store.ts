import { create } from "zustand";
import type { Point } from "@labelit/contracts";

export type Tool =
  | "pointer"
  | "pan"
  | "brush"
  | "delete"
  | "select-click"
  | "select-region";

export type CellacdcMode =
  | "viewer"
  | "segmentation-tracking"
  | "cell-cycle"
  | "custom-annotations";

export type CellacdcTool =
  | "navigate"
  | "inspect"
  | "paint"
  | "delete"
  | "track"
  | "annotate";

interface ToolState {
  tool: Tool;
  brushSize: number;
  showMasks: boolean;
  showOutlines: boolean;
  showLabels: boolean;
  showMissingCells: boolean;
  showNewCells: boolean;
  showTrackingLinks: boolean;
  autoContrast: boolean;

  cellacdcMode: CellacdcMode;
  cellacdcTool: CellacdcTool;
  currentFrame: number;
  currentZ: number;
  projection: "single" | "max" | "mean";

  // Alt+click merge interaction state (cross-tool).
  pendingMerge: Point | null;

  // Click-select mode: pixels the user clicked, each resolving to an ROI label.
  pickedPoints: Point[];

  // Region-select mode: polygon vertices currently being drawn.
  regionPath: Point[];

  // Viewport transform
  zoom: number;
  pan: Point;

  setTool: (tool: Tool) => void;
  setBrushSize: (n: number) => void;
  toggleMasks: () => void;
  toggleOutlines: () => void;
  setShowMasks: (v: boolean) => void;
  setShowOutlines: (v: boolean) => void;
  toggleLabels: () => void;
  toggleMissingCells: () => void;
  toggleNewCells: () => void;
  toggleTrackingLinks: () => void;
  setAutoContrast: (v: boolean) => void;

  setCellacdcMode: (mode: CellacdcMode) => void;
  setCellacdcTool: (tool: CellacdcTool) => void;
  setCurrentFrame: (frame: number) => void;
  setCurrentZ: (z: number) => void;
  setProjection: (projection: "single" | "max" | "mean") => void;

  setPendingMerge: (p: Point | null) => void;

  addPickedPoint: (p: Point) => void;
  clearPickedPoints: () => void;

  addRegionVertex: (p: Point) => void;
  clearRegion: () => void;

  setZoom: (z: number | ((prev: number) => number)) => void;
  setPan: (p: Point | ((prev: Point) => Point)) => void;
  resetView: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: "pointer",
  brushSize: 3,
  showMasks: true,
  showOutlines: false,
  showLabels: true,
  showMissingCells: true,
  showNewCells: true,
  showTrackingLinks: true,
  autoContrast: true,

  cellacdcMode: "segmentation-tracking",
  cellacdcTool: "navigate",
  currentFrame: 0,
  currentZ: 0,
  projection: "single",

  pendingMerge: null,
  pickedPoints: [],
  regionPath: [],

  zoom: 1,
  pan: { x: 0, y: 0 },

  setTool: (tool) =>
    set({
      tool,
      // Switching tools clears any in-flight selection state.
      pickedPoints: [],
      regionPath: [],
      pendingMerge: null,
    }),
  setBrushSize: (brushSize) => set({ brushSize }),
  toggleMasks: () => set((s) => ({ showMasks: !s.showMasks })),
  toggleOutlines: () => set((s) => ({ showOutlines: !s.showOutlines })),
  setShowMasks: (showMasks) => set({ showMasks }),
  setShowOutlines: (showOutlines) => set({ showOutlines }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleMissingCells: () => set((s) => ({ showMissingCells: !s.showMissingCells })),
  toggleNewCells: () => set((s) => ({ showNewCells: !s.showNewCells })),
  toggleTrackingLinks: () => set((s) => ({ showTrackingLinks: !s.showTrackingLinks })),
  setAutoContrast: (autoContrast) => set({ autoContrast }),

  setCellacdcMode: (cellacdcMode) => set({ cellacdcMode }),
  setCellacdcTool: (cellacdcTool) => set({ cellacdcTool }),
  setCurrentFrame: (currentFrame) => set({ currentFrame }),
  setCurrentZ: (currentZ) => set({ currentZ }),
  setProjection: (projection) => set({ projection }),

  setPendingMerge: (pendingMerge) => set({ pendingMerge }),

  addPickedPoint: (p) =>
    set((s) => ({ pickedPoints: [...s.pickedPoints, p] })),
  clearPickedPoints: () => set({ pickedPoints: [] }),

  addRegionVertex: (p) =>
    set((s) => ({ regionPath: [...s.regionPath, p] })),
  clearRegion: () => set({ regionPath: [] }),

  setZoom: (z) =>
    set((s) => ({ zoom: typeof z === "function" ? z(s.zoom) : z })),
  setPan: (p) =>
    set((s) => ({ pan: typeof p === "function" ? p(s.pan) : p })),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
}));
