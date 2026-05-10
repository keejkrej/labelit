import { ChevronDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/menu";
import { useWebSocket } from "@/hooks/use-websocket";
import { useSessionStore } from "@/stores/session-store";

export function SaveMenu() {
  const { send } = useWebSocket();
  const image = useSessionStore((s) => s.image);
  const mask = useSessionStore((s) => s.mask);

  const disabled = !image || !mask || mask.nRois === 0;

  const saveSeg = () => send({ type: "image:save_seg", payload: {} });
  const saveMasksPng = () => send({ type: "image:save_masks", payload: {} });
  const saveOutlines = () => send({ type: "image:save_outlines", payload: {} });
  const saveRois = () => send({ type: "image:save_rois", payload: {} });
  const saveFlows = () => send({ type: "image:save_flows", payload: {} });

  return (
    <div className="inline-flex items-center">
      <Button
        className="rounded-e-none border-e-0"
        disabled={disabled}
        onClick={saveSeg}
        size="xs"
        variant="ghost"
      >
        <Save />
        save
      </Button>
      <Menu>
        <MenuTrigger
          render={
            <Button
              aria-label="Save format menu"
              className="rounded-s-none px-1"
              disabled={disabled}
              size="xs"
              variant="ghost"
            >
              <ChevronDown />
            </Button>
          }
        />
        <MenuPopup align="start" sideOffset={4}>
          <MenuItem onClick={saveSeg}>
            save _seg.npy <MenuShortcut>Ctrl+S</MenuShortcut>
          </MenuItem>
          <MenuItem onClick={saveMasksPng}>
            save masks PNG <MenuShortcut>Ctrl+N</MenuShortcut>
          </MenuItem>
          <MenuItem onClick={saveOutlines}>
            save outlines text <MenuShortcut>Ctrl+O</MenuShortcut>
          </MenuItem>
          <MenuItem onClick={saveRois}>
            save ROIs zip <MenuShortcut>Ctrl+R</MenuShortcut>
          </MenuItem>
          <MenuItem onClick={saveFlows}>
            save flows tif <MenuShortcut>Ctrl+F</MenuShortcut>
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
