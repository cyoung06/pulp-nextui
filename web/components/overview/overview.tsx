"use client";

import Link from "next/link";
import { useCallback } from "react";

import { DataTable } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { useSession } from "@/components/session/session-context";
import { TaskRow, taskColumns } from "@/components/tasks/task-row";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { get, list } from "@/lib/api/http";
import type { Status, Task } from "@/lib/api/types";
import { formatBytes } from "@/lib/formatting/bytes";
import { useList } from "@/lib/hooks/use-list";
import { useResource } from "@/lib/hooks/use-resource";
import type { Plugin } from "@/lib/plugins";
import { classNames } from "@/lib/utilities/class-names";

type Counts = { readonly repositories: number | null; readonly distributions: number | null };

const countOf = (path: string): Promise<number | null> =>
  list(path, { limit: 1, fields: "pulp_href" }).then(
    (page) => page.count,
    () => null,
  );

const PluginCard = ({ plugin }: { readonly plugin: Plugin }) => {
  const load = useCallback(
    async (): Promise<Counts> => {
      const [repositories, distributions] = await Promise.all([
        Promise.all(plugin.repositoryKinds.map((kind) => countOf(kind.path))).then((counts) =>
          counts.every((count) => count === null) ? null : counts.reduce<number>((sum, count) => sum + (count ?? 0), 0),
        ),
        countOf(plugin.distributions),
      ]);
      return { repositories, distributions };
    },
    [plugin],
  );
  const counts = useResource(load);
  return (
    <Link
      href={`/${plugin.key}`}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-background-secondary"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-muted text-accent">
          <Icon name={plugin.icon} size={15} />
        </span>
        <span className="text-[13px] font-medium text-foreground">{plugin.label}</span>
        <Icon
          name="arrow-right"
          size={13}
          className="ml-auto text-foreground-quaternary transition-transform group-hover:translate-x-0.5 group-hover:text-foreground-tertiary"
        />
      </div>
      <p className="text-xs leading-5 text-foreground-tertiary">{plugin.description}</p>
      <div className="mt-auto flex gap-5 text-xs text-foreground-tertiary">
        <span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {counts.data?.repositories ?? "–"}
          </span>{" "}
          repositories
        </span>
        <span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {counts.data?.distributions ?? "–"}
          </span>{" "}
          distributions
        </span>
      </div>
    </Link>
  );
};

const Dot = ({ ok }: { readonly ok: boolean }) => (
  <span className={classNames("inline-block h-2 w-2 shrink-0 rounded-full", ok ? "bg-success" : "bg-danger")} />
);

const loadStatus = (): Promise<Status> => get<Status>("status/");

const StatusPanel = () => {
  const status = useResource(loadStatus);
  const data = status.data;
  const storage = data?.storage;
  const used = storage?.used ?? null;
  const total = storage?.total ?? null;
  const share = used !== null && total ? Math.min(100, Math.round((used / total) * 100)) : null;
  const services: readonly (readonly [string, number | boolean | undefined])[] = data
    ? [
        ["API servers", data.online_api_apps.length],
        ["Content servers", data.online_content_apps.length],
        ["Workers", data.online_workers.length],
        ["Database", data.database_connection.connected],
        // Pulp reports Redis as not connected when it isn't configured to use one: show it only when used.
        ...(data.redis_connection?.connected ? ([["Redis", true]] as const) : []),
      ]
    : [];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-medium text-foreground">Server</h2>
      <ErrorText message={status.error} />
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex flex-col divide-y divide-border-subtle">
          {services.map(([label, value]) => (
            <div key={label} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
              <Dot ok={typeof value === "boolean" ? value : (value ?? 0) > 0} />
              <span className="flex-1 text-foreground-secondary">{label}</span>
              <span className="tabular-nums text-foreground">
                {typeof value === "boolean" ? (value ? "connected" : "down") : `${value} online`}
              </span>
            </div>
          ))}
          {share !== null && used !== null && total !== null ? (
            <div className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center text-[13px]">
                <span className="flex-1 text-foreground-secondary">Storage</span>
                <span className="tabular-nums text-foreground">
                  {formatBytes(used)} of {formatBytes(total)}
                </span>
              </div>
              <progress
                value={share}
                max={100}
                aria-label="Storage used"
                className="h-1.5 w-full overflow-hidden rounded-full bg-background-tertiary [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-background-tertiary [&::-webkit-progress-value]:bg-accent"
              />
            </div>
          ) : null}
        </div>
      </div>
      {data ? (
        <details className="group rounded-lg border border-border bg-surface">
          <summary className="flex cursor-default list-none items-center gap-2 px-4 py-2.5 text-[13px] text-foreground-secondary">
            <Icon name="chevron-right" size={13} className="transition-transform group-open:rotate-90" />
            Installed components
            <span className="ml-auto text-xs text-foreground-quaternary">{data.versions.length}</span>
          </summary>
          <div className="flex flex-col divide-y divide-border-subtle border-t border-border">
            {data.versions.map((version) => (
              <div key={version.component} className="flex items-center px-4 py-2 text-xs">
                <span className="flex-1 text-foreground-secondary">{version.component}</span>
                <span className="font-mono text-foreground-tertiary">{version.version}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
};

export const Overview = () => {
  const { plugins, user } = useSession();
  const tasks = useList<Task>("tasks/", { ordering: "-pulp_created" }, 8);
  return (
    <>
      <PageHeader
        title="Overview"
        icon={<Icon name="home" size={15} />}
        actions={<RefreshButton onRefresh={tasks.reload} />}
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 py-6 md:px-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Hello, {user.username}</h2>
            <p className="mt-0.5 text-[13px] text-foreground-tertiary">
              What this Pulp serves, and what it has been doing.
            </p>
          </div>
          {plugins.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {plugins.map((plugin) => (
                <PluginCard key={plugin.key} plugin={plugin} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-foreground-tertiary">
              This Pulp has none of the plugins this UI shows (Python, npm, Maven, containers).
            </p>
          )}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
            <section className="flex min-w-0 flex-col gap-3">
              <div className="flex items-center">
                <h2 className="flex-1 text-[13px] font-medium text-foreground">Recent tasks</h2>
                <Link href="/tasks" className="text-xs text-accent hover:underline">
                  All tasks
                </Link>
              </div>
              <ErrorText message={tasks.error} />
              <div className="scrollbar-thin overflow-x-auto rounded-lg border border-border bg-surface">
                <DataTable columns={taskColumns} minWidth="min-w-[480px]">
                  {tasks.data?.results.map((task) => <TaskRow key={task.pulp_href} task={task} />)}
                </DataTable>
                {tasks.data && tasks.data.results.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-foreground-tertiary">No tasks yet.</p>
                ) : null}
              </div>
            </section>
            <StatusPanel />
          </div>
        </div>
      </div>
    </>
  );
};
