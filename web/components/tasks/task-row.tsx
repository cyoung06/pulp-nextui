"use client";

import { useRouter } from "next/navigation";

import { Cell, Row } from "@/components/data/data-table";
import { TaskStateBadge } from "@/components/data/task-state";
import type { Task } from "@/lib/api/types";
import { formatDuration, formatRelative, formatTime } from "@/lib/formatting/dates";
import { describeTaskName } from "@/lib/formatting/tasks";
import { taskPagePath } from "@/lib/paths";

export const taskColumns = [
  { heading: "Task" },
  { heading: "State", className: "w-[120px]" },
  { heading: "Started", className: "w-[160px]" },
  { heading: "Took", className: "w-[90px] hidden sm:table-cell" },
] as const;

export const TaskRow = ({ task }: { readonly task: Task }) => {
  const router = useRouter();
  const { plugin, action } = describeTaskName(task.name);
  const started = task.started_at ?? task.pulp_created;
  return (
    <Row onClick={() => router.push(taskPagePath(task.pulp_href))}>
      <Cell>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded bg-background-tertiary px-1.5 py-0.5 font-mono text-2xs text-foreground-tertiary">
            {plugin}
          </span>
          <span className="truncate first-letter:uppercase">{action}</span>
        </div>
      </Cell>
      <Cell>
        <TaskStateBadge state={task.state} />
      </Cell>
      <Cell muted>
        <span title={formatTime(started)}>{formatRelative(started)}</span>
      </Cell>
      <Cell muted className="hidden tabular-nums sm:table-cell">
        {formatDuration(task.started_at, task.finished_at)}
      </Cell>
    </Row>
  );
};
