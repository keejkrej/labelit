import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldRow } from "@/components/sidebar-section";
import { useWebSocket } from "@/hooks/use-websocket";
import { useFsStore } from "@/stores/fs-store";

export function LoadPatternDialog({
  folder,
  open,
  onOpenChange,
}: {
  folder: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { send } = useWebSocket();
  const suggestedTemplates = useFsStore((s) => s.suggestedTemplates);

  const [subfolderTemplate, setSubfolderTemplate] = useState("");
  const [filenameTemplate, setFilenameTemplate] = useState("");

  // Initialize from suggestions when they arrive
  useEffect(() => {
    if (suggestedTemplates) {
      setSubfolderTemplate(suggestedTemplates.subfolder_template);
      setFilenameTemplate(suggestedTemplates.filename_template);
    }
  }, [suggestedTemplates]);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSubfolderTemplate("");
      setFilenameTemplate("");
      useFsStore.getState().setSuggestedTemplates(null);
    }
  }, [open]);

  const load = () => {
    if (!folder || !filenameTemplate) return;
    send({
      type: "fs:load_series_dataset",
      payload: {
        folder,
        subfolder_template: subfolderTemplate,
        filename_template: filenameTemplate,
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup
            className="row-start-2 flex w-full max-w-md flex-col gap-3 p-4"
            showCloseButton={false}
          >
            <DialogTitle className="text-base">Load folder with pattern</DialogTitle>
            <p className="text-sm text-muted-foreground mb-2">
              Use placeholders {"{t}"}, {"{p}"}, {"{c}"}, {"{z}"}. Subfolder matching is case-insensitive.
            </p>

            <FieldRow label="Subfolder template">
              <Input
                className="w-full"
                onChange={(e) => setSubfolderTemplate(e.currentTarget.value)}
                size="sm"
                value={subfolderTemplate}
                placeholder="e.g. Position_{p}"
              />
            </FieldRow>

            <FieldRow label="Filename template">
              <Input
                className="w-full"
                onChange={(e) => setFilenameTemplate(e.currentTarget.value)}
                size="sm"
                value={filenameTemplate}
                placeholder="e.g. img_{t}_{c}.tif"
              />
            </FieldRow>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={load} disabled={!filenameTemplate}>
                Load
              </Button>
            </div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
