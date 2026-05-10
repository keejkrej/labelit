import { useState } from "react";
import { FolderOpen } from "lucide-react";
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
import {
  Select,
  SelectButton,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "@/components/sidebar-section";
import { useWebSocket } from "@/hooks/use-websocket";
import { useFsStore } from "@/stores/fs-store";
import { useSessionStore } from "@/stores/session-store";

export function TrainDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { send } = useWebSocket();
  const openBrowser = useFsStore((s) => s.openBrowser);
  const models = useSessionStore((s) => s.models);

  const [trainDir, setTrainDir] = useState<string>("");
  const [modelName, setModelName] = useState<string>("my_model");
  const [baseModel, setBaseModel] = useState<string>("cpsam");
  const [nEpochs, setNEpochs] = useState<number>(100);
  const [learningRate, setLearningRate] = useState<number>(1e-5);
  const [batchSize, setBatchSize] = useState<number>(1);
  const [useGpu, setUseGpu] = useState<boolean>(true);

  const builtins = models.filter((m) => m.source === "builtin");

  const pickDir = () => {
    openBrowser("dir", { onPick: setTrainDir });
  };

  const start = () => {
    if (!trainDir || !modelName) return;
    send({
      type: "model:train",
      payload: {
        trainDir,
        modelName,
        baseModel,
        nEpochs,
        learningRate,
        batchSize,
        useGpu,
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
            <DialogTitle className="text-base">Train new model</DialogTitle>

            <FieldRow label="train dir">
              <div className="flex min-w-0 gap-1.5">
                <Input
                  className="min-w-0 flex-1"
                  onChange={(e) => setTrainDir(e.currentTarget.value)}
                  placeholder="path to folder with image+masks"
                  size="sm"
                  value={trainDir}
                />
                <Button onClick={pickDir} size="icon-sm" variant="outline">
                  <FolderOpen />
                </Button>
              </div>
            </FieldRow>

            <FieldRow label="model name">
              <Input
                onChange={(e) => setModelName(e.currentTarget.value)}
                size="sm"
                value={modelName}
              />
            </FieldRow>

            <FieldRow label="base model">
              <Select value={baseModel} onValueChange={(v) => setBaseModel(v as string)}>
                <SelectButton size="sm">
                  <SelectValue />
                </SelectButton>
                <SelectContent>
                  {builtins.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="n_epochs">
              <Input
                onChange={(e) => setNEpochs(Number(e.currentTarget.value))}
                size="sm"
                type="number"
                value={nEpochs}
              />
            </FieldRow>

            <FieldRow label="learning rate">
              <Input
                onChange={(e) => setLearningRate(Number(e.currentTarget.value))}
                size="sm"
                step="0.000001"
                type="number"
                value={learningRate}
              />
            </FieldRow>

            <FieldRow label="batch size">
              <Input
                onChange={(e) => setBatchSize(Number(e.currentTarget.value))}
                size="sm"
                type="number"
                value={batchSize}
              />
            </FieldRow>

            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                checked={useGpu}
                onChange={(e) => setUseGpu(e.currentTarget.checked)}
                type="checkbox"
              />
              <span>use GPU</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => onOpenChange(false)} size="sm" variant="outline">
                cancel
              </Button>
              <Button disabled={!trainDir || !modelName} onClick={start} size="sm">
                start training
              </Button>
            </div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
