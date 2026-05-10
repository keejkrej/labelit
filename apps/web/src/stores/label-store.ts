import { create } from "zustand";
import type { Label } from "@labelit/contracts";

interface LabelState {
  labels: Label[];
  setLabels: (labels: Label[]) => void;
  addLabel: (label: Label) => void;
  updateLabel: (label: Label) => void;
  removeLabel: (id: string) => void;
}

export const useLabelStore = create<LabelState>((set) => ({
  labels: [],

  setLabels: (labels) => set({ labels }),

  addLabel: (label) =>
    set((state) => ({
      labels: [...state.labels, label],
    })),

  updateLabel: (label) =>
    set((state) => ({
      labels: state.labels.map((l) => (l.id === label.id ? label : l)),
    })),

  removeLabel: (id) =>
    set((state) => ({
      labels: state.labels.filter((l) => l.id !== id),
    })),
}));
