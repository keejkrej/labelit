import { create } from "zustand";

export type Tool = "pointer" | "pan" | "brush" | "delete";

interface ToolState {
  tool: Tool;
  brushSize: number;
  showMasks: boolean;
  showOutlines: boolean;
  setTool: (tool: Tool) => void;
  setBrushSize: (n: number) => void;
  toggleMasks: () => void;
  toggleOutlines: () => void;
  setShowMasks: (v: boolean) => void;
  setShowOutlines: (v: boolean) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: "pointer",
  brushSize: 3,
  showMasks: true,
  showOutlines: false,
  setTool: (tool) => set({ tool }),
  setBrushSize: (brushSize) => set({ brushSize }),
  toggleMasks: () => set((s) => ({ showMasks: !s.showMasks })),
  toggleOutlines: () => set((s) => ({ showOutlines: !s.showOutlines })),
  setShowMasks: (showMasks) => set({ showMasks }),
  setShowOutlines: (showOutlines) => set({ showOutlines }),
}));
