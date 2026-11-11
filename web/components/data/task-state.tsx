import { Icon } from "@/components/ui/icon";
import type { TaskState } from "@/lib/api/types";

import { Badge, type BadgeTone } from "./badge";

const tones: Readonly<Record<TaskState, BadgeTone>> = {
  waiting: "neutral",
  skipped: "neutral",
  running: "info",
  completed: "success",
  failed: "danger",
  canceled: "warning",
  canceling: "warning",
};

export const isFinished = (state: TaskState): boolean =>
  state === "completed" || state === "failed" || state === "canceled" || state === "skipped";

export const TaskStateBadge = ({ state }: { readonly state: TaskState }) => (
  <Badge tone={tones[state] ?? "neutral"}>
    {state === "running" ? <Icon name="spinner" size={10} className="animate-spin" /> : null}
    {state}
  </Badge>
);
