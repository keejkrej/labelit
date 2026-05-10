import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/menu";
import { TrainDialog } from "@/components/train-dialog";
import { useWebSocket } from "@/hooks/use-websocket";
import { useFsStore } from "@/stores/fs-store";
import { useSessionStore } from "@/stores/session-store";
import { useToolStore } from "@/stores/tool-store";

export function HeaderMenus() {
  const { send } = useWebSocket();
  const openBrowser = useFsStore((s) => s.openBrowser);
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  const showMasks = useToolStore((s) => s.showMasks);
  const toggleMasks = useToolStore((s) => s.toggleMasks);
  const showOutlines = useToolStore((s) => s.showOutlines);
  const toggleOutlines = useToolStore((s) => s.toggleOutlines);
  const [trainOpen, setTrainOpen] = useState(false);

  const hasImage = !!image;
  const hasMasks = !!mask && mask.nRois > 0;
  const canUndo = !!mask?.canUndo;
  const canRedo = !!mask?.canRedo;

  return (
    <>
      <nav className="flex items-center gap-0.5">
        {/* File */}
        <Menu>
          <MenuTrigger
            render={<Button size="xs" variant="ghost">File</Button>}
          />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem onClick={() => openBrowser("image")}>
              Load image <MenuShortcut>Ctrl+L</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!hasImage}
              onClick={() => openBrowser("mask")}
            >
              Load masks <MenuShortcut>Ctrl+M</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!hasImage}
              onClick={() => openBrowser("mask")}
            >
              Load processed (_seg.npy) <MenuShortcut>Ctrl+P</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              disabled={!hasMasks}
              onClick={() => send({ type: "image:save_seg", payload: {} })}
            >
              Save _seg.npy <MenuShortcut>Ctrl+S</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!hasMasks}
              onClick={() => send({ type: "image:save_masks", payload: {} })}
            >
              Save masks PNG/tif <MenuShortcut>Ctrl+N</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!hasMasks}
              onClick={() => send({ type: "image:save_outlines", payload: {} })}
            >
              Save outlines text <MenuShortcut>Ctrl+O</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!hasMasks}
              onClick={() => send({ type: "image:save_rois", payload: {} })}
            >
              Save ROIs zip (ImageJ) <MenuShortcut>Ctrl+R</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!hasMasks}
              onClick={() => send({ type: "image:save_flows", payload: {} })}
            >
              Save flows tif <MenuShortcut>Ctrl+F</MenuShortcut>
            </MenuItem>
          </MenuPopup>
        </Menu>

        {/* Edit */}
        <Menu>
          <MenuTrigger
            render={<Button size="xs" variant="ghost">Edit</Button>}
          />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem
              disabled={!canUndo}
              onClick={() => send({ type: "mask:undo" })}
            >
              Undo <MenuShortcut>Ctrl+Z</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!canRedo}
              onClick={() => send({ type: "mask:redo" })}
            >
              Redo <MenuShortcut>Ctrl+Y</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              disabled={!hasMasks}
              onClick={() => send({ type: "mask:clear" })}
            >
              Clear all masks <MenuShortcut>Ctrl+0</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuCheckboxItem
              checked={showMasks}
              onCheckedChange={toggleMasks}
            >
              Show masks <MenuShortcut>X</MenuShortcut>
            </MenuCheckboxItem>
            <MenuCheckboxItem
              checked={showOutlines}
              onCheckedChange={toggleOutlines}
            >
              Show outlines <MenuShortcut>Z</MenuShortcut>
            </MenuCheckboxItem>
          </MenuPopup>
        </Menu>

        {/* Models */}
        <Menu>
          <MenuTrigger
            render={<Button size="xs" variant="ghost">Models</Button>}
          />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem onClick={() => setTrainOpen(true)}>
              Train new model… <MenuShortcut>Ctrl+T</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => send({ type: "model:list" })}>
              Refresh model list
            </MenuItem>
            <MenuItem disabled>Add custom model (server-side)</MenuItem>
          </MenuPopup>
        </Menu>

        {/* Help */}
        <Menu>
          <MenuTrigger
            render={<Button size="xs" variant="ghost">Help</Button>}
          />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem
              onClick={() =>
                window.open("https://cellpose.readthedocs.io/", "_blank")
              }
            >
              Cellpose docs
            </MenuItem>
            <MenuItem
              onClick={() =>
                window.open(
                  "https://cellpose.readthedocs.io/en/latest/train.html",
                  "_blank",
                )
              }
            >
              Training instructions
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onClick={() => send({ type: "ping" })}
            >
              Send ping
            </MenuItem>
          </MenuPopup>
        </Menu>
      </nav>
      <TrainDialog open={trainOpen} onOpenChange={setTrainOpen} />
    </>
  );
}
