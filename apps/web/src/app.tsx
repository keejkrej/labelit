import { useWebSocket } from "./hooks/use-websocket";
import { useLabelStore } from "./stores/label-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Tag, Trash2 } from "lucide-react";

export function App() {
  const { status, sendMessage } = useWebSocket();
  const labels = useLabelStore((s) => s.labels);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Tag className="size-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Labelit</h1>
          </div>
          <Badge
            variant={
              status === "connected"
                ? "success"
                : status === "connecting"
                  ? "warning"
                  : "destructive"
            }
          >
            <span
              className={`size-1.5 rounded-full ${
                status === "connected"
                  ? "bg-success-foreground animate-pulse"
                  : status === "connecting"
                    ? "bg-warning-foreground animate-pulse"
                    : "bg-destructive-foreground"
              }`}
            />
            {status}
          </Badge>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Labels</h2>
            <p className="text-sm text-muted-foreground">
              Manage your annotation labels
            </p>
          </div>
          <Button
            disabled={status !== "connected"}
            onClick={() =>
              sendMessage({
                type: "label:create",
                payload: {
                  name: `Label ${labels.length + 1}`,
                  color: `#${Math.floor(Math.random() * 16777215)
                    .toString(16)
                    .padStart(6, "0")}`,
                },
              })
            }
          >
            <Plus />
            New Label
          </Button>
        </div>

        {labels.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                <Tag className="size-5 text-muted-foreground" />
              </div>
              <CardTitle className="mb-1 text-sm">No labels yet</CardTitle>
              <CardDescription className="text-xs">
                Create your first label to get started
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {labels.map((label) => (
              <Card key={label.id} className="group transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className="size-4 shrink-0 rounded-full ring-2 ring-border"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 truncate text-sm font-medium">
                    {label.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={() =>
                      sendMessage({
                        type: "label:delete",
                        payload: { id: label.id },
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
