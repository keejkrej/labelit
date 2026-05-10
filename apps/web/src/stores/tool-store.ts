import { create } from "zustand";
import type { Point } from "@labelit/contracts";

export type Tool =
  | "pointer"
  | "pan"
  | "brush"
  | "delete"
  | "select-click"
  | "select-region";

interface ToolState {
  tool: Tool;
  brushSize: number;
  showMasks: boolean;
  showOutlines: boolean;

  // Alt+click merge interaction state (cross-tool).
  pendingMerge: Point | null;

  // Click-select mode: pixels the user clicked, each resolving to an ROI label.
  pickedPoints: Point[];

  // Region-select mode: polygon vertices currently being drawn.
  regionPath: Point[];

  setTool: (tool: Tool) => void;
  setBrushSize: (n: number) => void;
  toggleMasks: () => void;
  toggleOutlines: () => void;
  setShowMasks: (v: boolean) => void;
  setShowOutlines: (v: boolean) => void;

  setPendingMerge: (p: Point | null) => void;

  addPickedPoint: (p: Point) => void;
  clearPickedPoints: () => void;

  addRegionVertex: (p: Point) => void;
  clearRegion: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: "pointer",
  brushSize: 3,
  showMasks: true,
  showOutlines: false,

  pendingMerge: null,
  pickedPoints: [],
  regionPath: [],

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

  setPendingMerge: (pendingMerge) => set({ pendingMerge }),

  addPickedPoint: (p) =>
    set((s) => ({ pickedPoints: [...s.pickedPoints, p] })),
  clearPickedPoints: () => set({ pickedPoints: [] }),

  addRegionVertex: (p) =>
    set((s) => ({ regionPath: [...s.regionPath, p] })),
  clearRegion: () => set({ regionPath: [] }),
}));
