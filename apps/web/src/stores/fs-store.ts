import { create } from "zustand";
import type { DirListedPayload, FsEntry, RootsListedPayload } from "@labelit/contracts";

export type BrowserView =
  | { kind: "roots"; data: RootsListedPayload | null }
  | { kind: "dir"; data: DirListedPayload };

interface FsState {
  open: boolean;
  /**
   * "image"/"mask" → filter common image extensions.
   * "save" → no filter.
   * "dir" → return the chosen directory via `onPick` instead of dispatching a ws message.
   */
  mode: "image" | "mask" | "save" | "dir";
  view: BrowserView;
  home: string | null;
  loading: boolean;
  error: string | null;
  selected: FsEntry | null;
  onPick: ((path: string) => void) | null;
  autoloadMasks: boolean;
  disableAutosave: boolean;
  suggestedTemplates: { subfolder_template: string; filename_template: string } | null;

  openBrowser: (
    mode: FsState["mode"],
    options?: { onPick?: (path: string) => void },
  ) => void;
  closeBrowser: () => void;
  setRoots: (data: RootsListedPayload) => void;
  setDir: (data: DirListedPayload) => void;
  setHome: (path: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelected: (entry: FsEntry | null) => void;
  setAutoloadMasks: (val: boolean) => void;
  setDisableAutosave: (val: boolean) => void;
  setSuggestedTemplates: (val: { subfolder_template: string; filename_template: string } | null) => void;
}

export const useFsStore = create<FsState>((set) => ({
  open: false,
  mode: "image",
  view: { kind: "roots", data: null },
  home: null,
  loading: false,
  error: null,
  selected: null,
  onPick: null,
  autoloadMasks: false,
  disableAutosave: false,
  suggestedTemplates: null,

  openBrowser: (mode, options) =>
    set({
      open: true,
      mode,
      selected: null,
      error: null,
      view: { kind: "roots", data: null },
      onPick: options?.onPick ?? null,
    }),
  closeBrowser: () =>
    set({ open: false, selected: null, error: null, onPick: null }),
  setRoots: (data) =>
    set({ view: { kind: "roots", data }, loading: false, error: null }),
  setDir: (data) =>
    set({ view: { kind: "dir", data }, loading: false, error: null, selected: null }),
  setHome: (path) => set({ home: path }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setSelected: (entry) => set({ selected: entry }),
  setAutoloadMasks: (autoloadMasks) => set({ autoloadMasks }),
  setDisableAutosave: (disableAutosave) => set({ disableAutosave }),
  setSuggestedTemplates: (suggestedTemplates) => set({ suggestedTemplates }),
}));

export const IMAGE_PATTERNS = ["*.tif", "*.tiff", "*.png", "*.jpg", "*.jpeg", "*.bmp"];
export const MASK_PATTERNS = [...IMAGE_PATTERNS, "*.npy", "*.npz"];
