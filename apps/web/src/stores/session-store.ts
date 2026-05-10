import { create } from "zustand";
import type { ImageMeta, MaskState, ModelInfo } from "@labelit/contracts";

interface SegmentationProgress {
  job: "run" | "train";
  progress: number;
  message?: string;
}

export interface SegmentationParams {
  model: string;
  diameter: number | null;
  flowThreshold: number;
  cellprobThreshold: number;
  niter: number;
  minSize: number;
  anisotropy: number;
  useGpu: boolean;
}

export const defaultSegmentationParams: SegmentationParams = {
  model: "cpsam",
  diameter: null,
  flowThreshold: 0.4,
  cellprobThreshold: 0.0,
  niter: 0,
  minSize: 15,
  anisotropy: 1.0,
  useGpu: true,
};

interface SessionState {
  image: ImageMeta | null;
  mask: MaskState | null;
  models: ModelInfo[];
  progress: SegmentationProgress | null;
  segPath: string | null;
  params: SegmentationParams;

  setImage: (image: ImageMeta | null) => void;
  setMask: (mask: MaskState | null) => void;
  setModels: (models: ModelInfo[]) => void;
  setProgress: (progress: SegmentationProgress | null) => void;
  setRunDone: (segPath: string | null) => void;
  setParams: (patch: Partial<SegmentationParams>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  image: null,
  mask: null,
  models: [],
  progress: null,
  segPath: null,
  params: defaultSegmentationParams,

  setImage: (image) => set({ image, mask: null, segPath: null }),
  setMask: (mask) => set({ mask }),
  setModels: (models) => set({ models }),
  setProgress: (progress) => set({ progress }),
  setRunDone: (segPath) => set({ segPath, progress: null }),
  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
}));
