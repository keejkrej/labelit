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
import { LoadPatternDialog } from "@/components/load-pattern-dialog";
import { useWebSocket } from "@/hooks/use-websocket";
import { useFsStore } from "@/stores/fs-store";
import { useSessionStore } from "@/stores/session-store";
import { useToolStore } from "@/stores/tool-store";
import { SaveMenuItems } from "./save-menu";

export function HeaderMenus() {
  const { send } = useWebSocket();
  const openBrowser = useFsStore((s) => s.openBrowser);
  const autoloadMasks = useFsStore((s) => s.autoloadMasks);
  const setAutoloadMasks = useFsStore((s) => s.setAutoloadMasks);
  const disableAutosave = useFsStore((s) => s.disableAutosave);
  const setDisableAutosave = useFsStore((s) => s.setDisableAutosave);
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);
  const showMasks = useToolStore((s) => s.showMasks);
  const toggleMasks = useToolStore((s) => s.toggleMasks);
  const showOutlines = useToolStore((s) => s.showOutlines);
  const toggleOutlines = useToolStore((s) => s.toggleOutlines);
  const setTool = useToolStore((s) => s.setTool);
  const [trainOpen, setTrainOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [patternFolder, setPatternFolder] = useState("");

  const hasImage = !!image;
  const hasMasks = !!mask && mask.nRois > 0;
  const canUndo = !!mask?.canUndo;
  const canRedo = !!mask?.canRedo;

  const handleLoadFolderPattern = () => {
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
      <nav className="flex items-center gap-0.5">
        {/* File */}
        <Menu>
          <MenuTrigger
            render={<Button size="xs" variant="ghost">File</Button>}
          />
          <MenuPopup align="start" sideOffset={4}>
            <MenuItem onClick={() => openBrowser("image")}>
              Load image (*.tif, *.png, *.jpg) <MenuShortcut>Ctrl+L</MenuShortcut>
            </MenuItem>
            <MenuItem onClick={handleLoadFolderPattern}>
              Load folder with pattern... <MenuShortcut>Ctrl+Shift+L</MenuShortcut>
            </MenuItem>
            <MenuCheckboxItem
              checked={autoloadMasks}
              onCheckedChange={setAutoloadMasks}
            >
              Autoload masks from _masks.tif file
            </MenuCheckboxItem>
            <MenuCheckboxItem
              checked={disableAutosave}
              onCheckedChange={setDisableAutosave}
            >
              Disable autosave _seg.npy file
            </MenuCheckboxItem>
            <MenuItem
              disabled={!hasImage}
              onClick={() => openBrowser("mask")}
            >
              Load masks (*.tif, *.png, *.jpg) <MenuShortcut>Ctrl+M</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!hasImage}
              onClick={() => openBrowser("mask")}
            >
              Load processed/labelled image (*_seg.npy) <MenuShortcut>Ctrl+P</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <SaveMenuItems />
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
              Undo previous mask/trace <MenuShortcut>Ctrl+Z</MenuShortcut>
            </MenuItem>
            <MenuItem
              disabled={!canRedo}
              onClick={() => send({ type: "mask:redo" })}
            >
              Undo remove mask <MenuShortcut>Ctrl+Y</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              disabled={!hasMasks}
              onClick={() => send({ type: "mask:clear" })}
            >
              Clear all masks <MenuShortcut>Ctrl+0</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem disabled>
              Remove selected cell (Ctrl+CLICK) <MenuShortcut>Ctrl+Click</MenuShortcut>
            </MenuItem>
            <MenuItem disabled>
              FYI: Merge cells by Alt+Click
            </MenuItem>
            <MenuItem onClick={() => setTool("select-click")}>
              Select Points <MenuShortcut>S</MenuShortcut>
            </MenuItem>
            <MenuItem onClick={() => setTool("select-region")}>
              Select Region <MenuShortcut>R</MenuShortcut>
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
            <MenuItem disabled>Add custom torch model to GUI</MenuItem>
            <MenuItem disabled>Remove selected custom model from GUI</MenuItem>
            <MenuItem onClick={() => setTrainOpen(true)}>
              Train new model with image+masks in folder <MenuShortcut>Ctrl+T</MenuShortcut>
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
            <MenuItem onClick={() => send({ type: "model:list" })}>
              Refresh model list
            </MenuItem>
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
              Help with GUI <MenuShortcut>Ctrl+H</MenuShortcut>
            </MenuItem>
            <MenuItem disabled>
              GUI layout <MenuShortcut>Ctrl+G</MenuShortcut>
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
      <LoadPatternDialog folder={patternFolder} open={patternOpen} onOpenChange={setPatternOpen} />
    </>
  );
}
