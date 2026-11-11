"use client";

import { useState } from "react";

import { DataTable } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TabButton } from "@/components/data/tab-link";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import type { Task } from "@/lib/api/types";
import { useList } from "@/lib/hooks/use-list";

import { TaskRow, taskColumns } from "./task-row";

const filters = [
  { key: "all", label: "All", states: "" },
  { key: "active", label: "Active", states: "waiting,running,canceling" },
  { key: "failed", label: "Failed", states: "failed" },
  { key: "completed", label: "Completed", states: "completed" },
  { key: "canceled", label: "Canceled", states: "canceled,skipped" },
] as const;

export const TaskList = () => {
  const [filter, setFilter] = useState<(typeof filters)[number]>(filters[0]);
  const tasks = useList<Task>("tasks/", { ordering: "-pulp_created", state__in: filter.states }, 50);
  return (
    <>
      <PageHeader
        title="Tasks"
        icon={<Icon name="activity" size={15} />}
        tabs={filters.map((item) => (
          <TabButton key={item.key} active={item.key === filter.key} onClick={() => setFilter(item)}>
            {item.label}
          </TabButton>
        ))}
        actions={<RefreshButton onRefresh={tasks.reload} />}
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <ErrorText message={tasks.error} className="m-3" />
        {tasks.data && tasks.data.count === 0 ? (
          <EmptyState
            fill
            icon={<Icon name="activity" size={18} />}
            title="No tasks"
            description="Syncs, uploads and deletions run as tasks on Pulp's workers; they show up here."
          />
        ) : (
          <DataTable columns={taskColumns}>
            {tasks.data?.results.map((task) => <TaskRow key={task.pulp_href} task={task} />)}
          </DataTable>
        )}
      </div>
      {tasks.data ? (
        <Pagination count={tasks.data.count} offset={tasks.offset} limit={tasks.limit} onChange={tasks.setOffset} />
      ) : null}
    </>
  );
};
