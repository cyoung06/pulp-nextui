"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Cell, DataTable, Row } from "@/components/data/data-table";
import { HrefName } from "@/components/data/href-name";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import type { Repository } from "@/lib/api/types";
import { formatRelative, formatTime } from "@/lib/formatting/dates";
import { useList } from "@/lib/hooks/use-list";
import { repositoryPagePath } from "@/lib/paths";
import { pluginByKey, repositoryKindOf, type PluginKey } from "@/lib/plugins";

import { PluginHeader } from "./plugin-header";
import { RepositoryDialog } from "./repository-dialog";

const versionNumber = (href: string | null | undefined): string => {
  const match = href ? /\/versions\/(\d+)\/$/.exec(href) : null;
  return match ? match[1] : "0";
};

export const RepositoryList = ({ pluginKey }: { readonly pluginKey: PluginKey }) => {
  const plugin = pluginByKey(pluginKey)!;
  const kind = repositoryKindOf(plugin, useSearchParams().get("kind"));
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const repositories = useList<Repository>(kind.path, { ordering: "name", name__icontains: search });

  const columns = [
    { heading: "Name" },
    { heading: "Version", className: "w-[90px]" },
    ...(kind.sync ? [{ heading: "Remote", className: "w-[200px] hidden md:table-cell" }] : []),
    { heading: "Updated", className: "w-[150px] hidden sm:table-cell" },
  ];

  return (
    <>
      <PluginHeader
        plugin={plugin}
        active={kind.key}
        actions={
          <>
            <RefreshButton onRefresh={repositories.reload} />
            {kind.creatable ? (
              <Button variant="primary" leadingIcon={<Icon name="plus" size={13} />} onClick={() => setCreating(true)}>
                New repository
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <SearchInput placeholder="Filter by name" onSearch={setSearch} />
        {repositories.data ? (
          <span className="ml-auto text-xs tabular-nums text-foreground-quaternary">
            {repositories.data.count} {repositories.data.count === 1 ? "repository" : "repositories"}
          </span>
        ) : null}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <ErrorText message={repositories.error} className="m-3" />
        {repositories.data && repositories.data.count === 0 ? (
          <EmptyState
            fill
            icon={<Icon name={plugin.icon} size={18} />}
            title={search ? "No matching repositories" : "No repositories yet"}
            description={
              kind.creatable
                ? "A repository holds versions of a set of packages; a distribution serves one."
                : "Push an image to a distribution's path and Pulp creates its repository."
            }
            action={
              kind.creatable && !search ? (
                <Button className="mt-2" onClick={() => setCreating(true)}>
                  New repository
                </Button>
              ) : null
            }
          />
        ) : (
          <DataTable columns={columns}>
            {repositories.data?.results.map((repository) => (
              <Row
                key={repository.pulp_href}
                onClick={() => router.push(repositoryPagePath(plugin.key, kind.key, repository.pulp_href))}
              >
                <Cell>
                  <Link
                    href={repositoryPagePath(plugin.key, kind.key, repository.pulp_href)}
                    className="font-medium text-foreground hover:underline"
                  >
                    {repository.name}
                  </Link>
                  {repository.description ? (
                    <div className="truncate text-xs text-foreground-tertiary">{repository.description}</div>
                  ) : null}
                </Cell>
                <Cell muted className="tabular-nums">
                  v{versionNumber(repository.latest_version_href)}
                </Cell>
                {kind.sync ? (
                  <Cell muted className="hidden md:table-cell">
                    <HrefName href={repository.remote} />
                  </Cell>
                ) : null}
                <Cell muted className="hidden sm:table-cell">
                  <span title={formatTime(repository.pulp_last_updated)}>
                    {formatRelative(repository.pulp_last_updated ?? repository.pulp_created)}
                  </span>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </div>
      {repositories.data ? (
        <Pagination
          count={repositories.data.count}
          offset={repositories.offset}
          limit={repositories.limit}
          onChange={repositories.setOffset}
        />
      ) : null}
      {creating ? (
        <RepositoryDialog
          plugin={plugin}
          kind={kind}
          onClose={() => setCreating(false)}
          onSaved={(result) => {
            const created = result as Repository;
            if (created?.pulp_href) {
              router.push(repositoryPagePath(plugin.key, kind.key, created.pulp_href));
            } else {
              void repositories.reload();
            }
          }}
        />
      ) : null}
    </>
  );
};
