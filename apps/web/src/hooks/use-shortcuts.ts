import { useEffect } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useFsStore } from "@/stores/fs-store";
import { useToolStore } from "@/stores/tool-store";

/**
 * Global keyboard shortcuts matching cellpose-gui where applicable.
 * Skips when focus is inside an input/textarea/contenteditable.
 */
export function useShortcuts(): void {
  const { send } = useWebSocket();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && !e.shiftKey) {
        switch (key) {
          case "l":
            e.preventDefault();
            useFsStore.getState().openBrowser("image");
            return;
          case "m":
          case "p":
            e.preventDefault();
            useFsStore.getState().openBrowser("mask");
            return;
          case "s":
            e.preventDefault();
            send({ type: "image:save_seg", payload: {} });
            return;
          case "n":
            e.preventDefault();
            send({ type: "image:save_masks", payload: {} });
            return;
          case "o":
            e.preventDefault();
            send({ type: "image:save_outlines", payload: {} });
            return;
          case "r":
            e.preventDefault();
            send({ type: "image:save_rois", payload: {} });
            return;
          case "f":
            e.preventDefault();
            send({ type: "image:save_flows", payload: {} });
            return;
          case "z":
            e.preventDefault();
            send({ type: "mask:undo" });
            return;
          case "y":
            e.preventDefault();
            send({ type: "mask:redo" });
            return;
          case "0":
            e.preventDefault();
            send({ type: "mask:clear" });
            return;
        }
      }

      // single-key shortcuts (cellpose convention)
      if (!ctrl && !e.shiftKey && !e.altKey) {
        switch (key) {
          case "x":
            e.preventDefault();
            useToolStore.getState().toggleMasks();
            return;
          case "z":
            e.preventDefault();
            useToolStore.getState().toggleOutlines();
            return;
          case "b":
            e.preventDefault();
            useToolStore.getState().setTool("brush");
            return;
          case "v":
            e.preventDefault();
            useToolStore.getState().setTool("pointer");
            return;
          case "e":
            e.preventDefault();
            useToolStore.getState().setTool("delete");
            return;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);
}
