"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { RepositoryAccess } from "@/components/access-control/repository-access";
import { ContainerContent } from "@/components/content/container-content";
import { PackageBrowser } from "@/components/content/package-browser";
import type { ContentViewProps } from "@/components/content/types";
import { Badge } from "@/components/data/badge";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Details } from "@/components/data/details";
import { HrefName } from "@/components/data/href-name";
import { TabButton } from "@/components/data/tab-link";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { get, getApiBase, list, remove } from "@/lib/api/http";
import type { Distribution, Repository } from "@/lib/api/types";
import { formatRelative, formatTime } from "@/lib/formatting/dates";
import { useResource } from "@/lib/hooks/use-resource";
import { useTaskNotice } from "@/lib/hooks/use-task-notice";
import { pluginByKey, repositoryKindOf, type Plugin, type PluginKey } from "@/lib/plugins";

import { DistributionDialog } from "./distribution-dialog";
import { DistributionPanel } from "./distribution-panel";
import { RepositoryDialog } from "./repository-dialog";
import { SyncDialog } from "./sync-dialog";
import { UploadDialog } from "./upload-dialog";
import { UsageSnippets } from "./usage-snippets";
import { VersionList } from "./version-list";

const contentViews: Readonly<Record<PluginKey, (props: ContentViewProps) => React.ReactNode>> = {
  python: PackageBrowser,
  npm: PackageBrowser,
  maven: PackageBrowser,
  container: ContainerContent,
};

type Dialog = "edit" | "delete" | "sync" | "upload" | "distribute" | null;

const versionNumber = (href: string | null | undefined): number => {
  const match = href ? /\/versions\/(\d+)\/$/.exec(href) : null;
  return match ? Number(match[1]) : 0;
};

const ServedBy = ({
  plugin,
  repository,
  onNew,
  onChanged,
}: {
  readonly plugin: Plugin;
  readonly repository: Repository;
  readonly onNew: () => void;
  readonly onChanged: (message: string, result: unknown) => void;
}) => {
  const load = useCallback(
    () => list<Distribution>(plugin.distributions, { repository: repository.pulp_href, ordering: "name" }),
    [plugin.distributions, repository.pulp_href],
  );
  const distributions = useResource(load);
  const [open, setOpen] = useState<Distribution | null>(null);
  const first = distributions.data?.results[0];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[13px] font-medium text-foreground">Served at</h2>
        <Button size="small" leadingIcon={<Icon name="plus" size={12} />} onClick={onNew}>
          Distribute
        </Button>
      </div>
      <ErrorText message={distributions.error} />
      {distributions.data && distributions.data.results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-foreground-tertiary">
          Not served yet. Add a distribution to give it an address clients can use.
        </p>
      ) : null}
      {distributions.data && distributions.data.results.length > 0 ? (
        <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface">
          {distributions.data.results.map((distribution) => (
            <button
              key={distribution.pulp_href}
              type="button"
              onClick={() => setOpen(distribution)}
              className="flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary"
            >
              <Icon name="globe" size={13} className="shrink-0 text-foreground-tertiary" />
              <span className="shrink-0 text-[13px] font-medium text-foreground">{distribution.name}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground-tertiary">
                {distribution.registry_path ?? distribution.base_url ?? distribution.base_path}
              </span>
              {distribution.private ? <Badge tone="warning">private</Badge> : null}
              <Icon name="chevron-right" size={13} className="shrink-0 text-foreground-quaternary" />
            </button>
          ))}
        </div>
      ) : null}
      {first ? <UsageSnippets plugin={plugin} distribution={first} /> : null}
      {open ? (
        <DistributionPanel
          plugin={plugin}
          distribution={open}
          onClose={() => setOpen(null)}
          onChanged={(message, result) => {
            onChanged(message, result);
            void distributions.reload();
          }}
        />
      ) : null}
    </section>
  );
};

export const RepositoryDetail = ({ pluginKey }: { readonly pluginKey: PluginKey }) => {
  const plugin = pluginByKey(pluginKey)!;
  const query = useSearchParams();
  const kind = repositoryKindOf(plugin, query.get("kind"));
  const href = `${getApiBase()}${kind.path}${query.get("id") ?? ""}/`;
  const router = useRouter();
  const load = useCallback(() => get<Repository>(href), [href]);
  const repository = useResource(load);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [view, setView] = useState<"content" | "versions" | "access">("content");
  const [generation, setGeneration] = useState(0);
  const notices = useTaskNotice();
  const data = repository.data;
  const ContentView = contentViews[plugin.key];
  const listPath = kind === plugin.repositoryKinds[0] ? `/${plugin.key}` : `/${plugin.key}?kind=${kind.key}`;

  const changed = (message: string, result: unknown) => {
    notices.show(message, result);
    void repository.reload();
    setGeneration((value) => value + 1);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          <Link key="plugin" href={listPath} className="hover:text-foreground">
            {plugin.label}
          </Link>,
        ]}
        title={data?.name ?? "Repository"}
        icon={<Icon name={plugin.icon} size={15} />}
        actions={
          <>
            <RefreshButton
              onRefresh={async () => {
                setGeneration((value) => value + 1);
                await repository.reload();
              }}
            />
            {data && kind.creatable ? (
              <Button variant="ghost" leadingIcon={<Icon name="edit" size={13} />} onClick={() => setDialog("edit")}>
                Edit
              </Button>
            ) : null}
            {data && kind.deletable ? (
              <Button variant="ghost" leadingIcon={<Icon name="trash" size={13} />} onClick={() => setDialog("delete")}>
                Delete
              </Button>
            ) : null}
            {data && plugin.upload && kind.creatable ? (
              <Button leadingIcon={<Icon name="upload" size={13} />} onClick={() => setDialog("upload")}>
                Upload
              </Button>
            ) : null}
            {data && kind.sync ? (
              <Button variant="primary" leadingIcon={<Icon name="refresh" size={13} />} onClick={() => setDialog("sync")}>
                Sync
              </Button>
            ) : null}
          </>
        }
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-8">
          <ErrorText message={repository.error} />
          {notices.element}
          {data ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
                <section className="flex flex-col gap-3">
                  <div className="flex items-center gap-1">
                    <TabButton active={view === "content"} onClick={() => setView("content")}>
                      Content
                    </TabButton>
                    <TabButton active={view === "versions"} onClick={() => setView("versions")}>
                      Versions
                    </TabButton>
                    {plugin.key !== "container" ? (
                      <TabButton active={view === "access"} onClick={() => setView("access")}>
                        Access
                      </TabButton>
                    ) : null}
                  </div>
                  {view === "content" ? (
                    <ContentView
                      key={`content-${generation}`}
                      plugin={plugin}
                      kind={kind}
                      repository={data}
                      versionHref={versionNumber(data.latest_version_href) > 0 ? (data.latest_version_href ?? null) : null}
                      onChanged={changed}
                    />
                  ) : view === "versions" ? (
                    <VersionList key={`versions-${generation}`} repository={data} />
                  ) : (
                    <RepositoryAccess key={`access-${generation}`} plugin={plugin} repository={data} onChanged={changed} />
                  )}
                  {view === "content" && versionNumber(data.latest_version_href) === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-foreground-tertiary">
                      This repository is empty.{" "}
                      {kind.sync ? "Sync it from a remote" : plugin.upload ? "Upload files" : "Push to it"} to add content.
                    </p>
                  ) : null}
                </section>
              <aside className="flex min-w-0 flex-col gap-6">
                  <section className="flex flex-col gap-3">
                    <h2 className="text-[13px] font-medium text-foreground">About</h2>
                    <div className="rounded-lg border border-border bg-surface p-4">
                      {data.description ? (
                        <p className="mb-4 text-[13px] leading-5 text-foreground-secondary">{data.description}</p>
                      ) : null}
                      <Details
                        items={[
                          ["Latest version", `v${versionNumber(data.latest_version_href)}`],
                          ["Kind", plugin.repositoryKinds.length > 1 ? kind.label : null],
                          ["Remote", data.remote ? <HrefName key="remote" href={data.remote} /> : kind.sync ? "None" : null],
                          ["Keeps", data.retain_repo_versions ? `${data.retain_repo_versions} versions` : "All versions"],
                          ["Created", <span key="created" title={formatTime(data.pulp_created)}>{formatRelative(data.pulp_created)}</span>],
                          [
                            "Labels",
                            data.pulp_labels && Object.keys(data.pulp_labels).length > 0 ? (
                              <span key="labels" className="flex flex-wrap gap-1">
                                {Object.entries(data.pulp_labels).map(([key, value]) => (
                                  <Badge key={key}>
                                    {key}={value}
                                  </Badge>
                                ))}
                              </span>
                            ) : null,
                          ],
                        ]}
                      />
                    </div>
                  </section>
                  <ServedBy
                    key={`served-${generation}`}
                    plugin={plugin}
                    repository={data}
                    onNew={() => setDialog("distribute")}
                    onChanged={changed}
                  />
              </aside>
            </div>
          ) : null}
        </div>
      </div>

      {data && dialog === "edit" ? (
        <RepositoryDialog
          plugin={plugin}
          kind={kind}
          repository={data}
          onClose={() => setDialog(null)}
          onSaved={(result) => changed(`Saving ${data.name}.`, result)}
        />
      ) : null}
      {data && dialog === "delete" ? (
        <ConfirmDialog
          title={`Delete ${data.name}?`}
          body="Its versions go with it, and distributions serving it stop serving it. Content shared with other repositories stays."
          confirmLabel="Delete"
          onConfirm={() => remove(data.pulp_href)}
          onClose={() => setDialog(null)}
          onDone={() => router.push(listPath)}
        />
      ) : null}
      {data && dialog === "sync" ? (
        <SyncDialog
          plugin={plugin}
          repository={data}
          onClose={() => setDialog(null)}
          onStarted={(result) => changed(`Syncing ${data.name}. A new version appears when it is done.`, result)}
        />
      ) : null}
      {data && dialog === "upload" ? (
        <UploadDialog
          plugin={plugin}
          repository={data}
          onClose={() => setDialog(null)}
          onUploaded={(fileName, result) => changed(`Adding ${fileName}.`, result)}
        />
      ) : null}
      {data && dialog === "distribute" ? (
        <DistributionDialog
          plugin={plugin}
          repository={data.pulp_href}
          onClose={() => setDialog(null)}
          onSaved={(result) => changed("Creating the distribution.", result)}
        />
      ) : null}
    </>
  );
};
