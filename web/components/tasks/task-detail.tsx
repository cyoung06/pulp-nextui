"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Details } from "@/components/data/details";
import { HrefName } from "@/components/data/href-name";
import { isFinished, TaskStateBadge } from "@/components/data/task-state";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { get, getApiBase, patch } from "@/lib/api/http";
import type { ProgressReport, Task } from "@/lib/api/types";
import { formatDuration, formatTime } from "@/lib/formatting/dates";
import { describeTaskName } from "@/lib/formatting/tasks";
import { useAction } from "@/lib/hooks/use-action";
import { useResource } from "@/lib/hooks/use-resource";
import { repositoryPagePath, taskPagePath, userPagePath } from "@/lib/paths";
import { repositoryKindOfHref } from "@/lib/plugins";

const Progress = ({ report }: { readonly report: ProgressReport }) => {
  const share = report.total ? Math.min(100, Math.round((report.done / report.total) * 100)) : null;
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="min-w-0 flex-1 truncate text-foreground-secondary">{report.message}</span>
        <span className="shrink-0 tabular-nums text-foreground-tertiary">
          {report.done}
          {report.total ? ` / ${report.total}` : ""}
        </span>
        <span className="w-20 shrink-0 text-right text-2xs uppercase tracking-wide text-foreground-quaternary">
          {report.state}
        </span>
      </div>
      {share !== null ? (
        <progress
          value={share}
          max={100}
          aria-label={report.message}
          className="h-1 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-background-tertiary [&::-webkit-progress-value]:bg-accent"
        />
      ) : null}
    </div>
  );
};

/** An href a task created or locked: a link when the UI has a page for it. */
const ResourceLink = ({ href }: { readonly href: string }) => {
  const path = href.startsWith("/") ? href : null;
  const repository = path ? repositoryKindOfHref(path.replace(/versions\/\d+\/$/, "")) : null;
  if (path && repository) {
    const repositoryHref = path.replace(/versions\/\d+\/$/, "");
    return (
      <Link
        href={repositoryPagePath(repository.plugin.key, repository.kind.key, repositoryHref)}
        className="text-accent hover:underline"
      >
        <HrefName href={path} />
      </Link>
    );
  }
  return <span className="font-mono text-xs text-foreground-secondary">{href}</span>;
};

const Section = ({ title, children }: { readonly title: string; readonly children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
    {children}
  </section>
);

export const TaskDetail = () => {
  const id = useSearchParams().get("id") ?? "";
  const href = `${getApiBase()}tasks/${id}/`;
  const load = useCallback(() => get<Task>(href), [href]);
  const task = useResource(load);
  const cancel = useAction();
  const data = task.data;
  const named = data ? describeTaskName(data.name) : null;
  const userHref = data?.created_by ?? null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          <Link key="tasks" href="/tasks" className="hover:text-foreground">
            Tasks
          </Link>,
        ]}
        title={named ? <span className="first-letter:uppercase">{named.action}</span> : "Task"}
        icon={<Icon name="activity" size={15} />}
        actions={
          <>
            {data && !isFinished(data.state) && data.state !== "canceling" ? (
              <Button
                variant="ghost"
                pending={cancel.pending}
                leadingIcon={<Icon name="x-circle" size={13} />}
                onClick={() => void cancel.run(() => patch(href, { state: "canceled" })).then(() => task.reload())}
              >
                Cancel
              </Button>
            ) : null}
            <RefreshButton onRefresh={task.reload} />
          </>
        }
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[860px] flex-col gap-8 px-4 py-6 md:px-8">
          <ErrorText message={task.error ?? cancel.error} />
          {data ? (
            <>
              <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <TaskStateBadge state={data.state} />
                  <span className="truncate font-mono text-xs text-foreground-tertiary">{data.name}</span>
                </div>
                <Details
                  items={[
                    ["Created", formatTime(data.pulp_created)],
                    ["Started", formatTime(data.started_at)],
                    ["Finished", formatTime(data.finished_at)],
                    ["Took", formatDuration(data.started_at, data.finished_at)],
                    [
                      "By",
                      userHref ? (
                        <Link href={userPagePath(userHref)} className="text-accent hover:underline">
                          <HrefName href={userHref} />
                        </Link>
                      ) : null,
                    ],
                    [
                      "Parent",
                      data.parent_task ? (
                        <Link href={taskPagePath(data.parent_task)} className="text-accent hover:underline">
                          View parent task
                        </Link>
                      ) : null,
                    ],
                    ["Correlation id", <span key="cid" className="font-mono text-xs">{data.logging_cid}</span>],
                  ]}
                />
              </div>

              {data.error ? (
                <Section title="Error">
                  <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
                    <p className="text-[13px] text-danger [overflow-wrap:anywhere]">
                      {data.error.description ?? JSON.stringify(data.error)}
                    </p>
                    {data.error.traceback ? (
                      <details className="mt-3">
                        <summary className="cursor-default text-xs text-foreground-tertiary">Traceback</summary>
                        <pre className="scrollbar-thin mt-2 max-h-[360px] overflow-auto rounded bg-background p-3 font-mono text-2xs leading-4 text-foreground-secondary">
                          {data.error.traceback}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </Section>
              ) : null}

              {data.progress_reports && data.progress_reports.length > 0 ? (
                <Section title="Progress">
                  <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface">
                    {data.progress_reports.map((report) => (
                      <Progress key={`${report.code}-${report.message}`} report={report} />
                    ))}
                  </div>
                </Section>
              ) : null}

              {data.created_resources && data.created_resources.filter(Boolean).length > 0 ? (
                <Section title="Created">
                  <ul className="flex flex-col gap-1.5 text-[13px]">
                    {data.created_resources.filter(Boolean).map((resource) => (
                      <li key={resource}>
                        <ResourceLink href={resource} />
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {data.reserved_resources_record && data.reserved_resources_record.length > 0 ? (
                <Section title="Worked on">
                  <ul className="flex flex-col gap-1.5 text-[13px]">
                    {data.reserved_resources_record.map((resource) => (
                      <li key={resource}>
                        <ResourceLink href={resource.replace(/^shared:/, "")} />
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {data.child_tasks && data.child_tasks.length > 0 ? (
                <Section title="Child tasks">
                  <ul className="flex flex-col gap-1.5 text-[13px]">
                    {data.child_tasks.map((child) => (
                      <li key={child}>
                        <Link href={taskPagePath(child)} className="font-mono text-xs text-accent hover:underline">
                          {child}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};
