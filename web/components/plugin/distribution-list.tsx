"use client";

import { useState } from "react";

import { Badge } from "@/components/data/badge";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { HrefName } from "@/components/data/href-name";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import type { Distribution } from "@/lib/api/types";
import { useList } from "@/lib/hooks/use-list";
import { useTaskNotice } from "@/lib/hooks/use-task-notice";
import { pluginByKey, type PluginKey } from "@/lib/plugins";

import { DistributionDialog } from "./distribution-dialog";
import { DistributionPanel } from "./distribution-panel";
import { PluginHeader } from "./plugin-header";

const columns = [
  { heading: "Name", className: "w-[28%]" },
  { heading: "Address" },
  { heading: "Serves", className: "w-[24%] hidden md:table-cell" },
] as const;

export const DistributionList = ({ pluginKey }: { readonly pluginKey: PluginKey }) => {
  const plugin = pluginByKey(pluginKey)!;
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Distribution | null>(null);
  const notices = useTaskNotice();
  const distributions = useList<Distribution>(plugin.distributions, { ordering: "name", name__icontains: search });

  return (
    <>
      <PluginHeader
        plugin={plugin}
        active="distributions"
        actions={
          <>
            <RefreshButton onRefresh={distributions.reload} />
            <Button variant="primary" leadingIcon={<Icon name="plus" size={13} />} onClick={() => setCreating(true)}>
              New distribution
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <SearchInput placeholder="Filter by name" onSearch={setSearch} />
        {distributions.data ? (
          <span className="ml-auto text-xs tabular-nums text-foreground-quaternary">
            {distributions.data.count} {distributions.data.count === 1 ? "distribution" : "distributions"}
          </span>
        ) : null}
      </div>
      {notices.element ? <div className="border-b border-border px-4 py-2">{notices.element}</div> : null}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <ErrorText message={distributions.error} className="m-3" />
        {distributions.data && distributions.data.count === 0 ? (
          <EmptyState
            fill
            icon={<Icon name="globe" size={18} />}
            title={search ? "No matching distributions" : "No distributions yet"}
            description="A distribution serves a repository (or caches a remote) at a path clients can reach."
          />
        ) : (
          <DataTable columns={columns}>
            {distributions.data?.results.map((distribution) => (
              <Row key={distribution.pulp_href} onClick={() => setOpen(distribution)}>
                <Cell>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{distribution.name}</span>
                    {distribution.private ? <Badge tone="warning">private</Badge> : null}
                  </div>
                </Cell>
                <Cell mono muted className="max-w-0 truncate">
                  {distribution.registry_path ?? distribution.base_url ?? distribution.base_path}
                </Cell>
                <Cell muted className="hidden md:table-cell">
                  {distribution.repository ? (
                    <HrefName href={distribution.repository} />
                  ) : distribution.repository_version ? (
                    <HrefName href={distribution.repository_version} />
                  ) : distribution.remote ? (
                    <span>
                      cache of <HrefName href={distribution.remote} />
                    </span>
                  ) : (
                    <span className="text-foreground-quaternary">nothing</span>
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </div>
      {distributions.data ? (
        <Pagination
          count={distributions.data.count}
          offset={distributions.offset}
          limit={distributions.limit}
          onChange={distributions.setOffset}
        />
      ) : null}
      {creating ? (
        <DistributionDialog
          plugin={plugin}
          onClose={() => setCreating(false)}
          onSaved={(result) => {
            notices.show("Creating the distribution.", result);
            void distributions.reload();
          }}
        />
      ) : null}
      {open ? (
        <DistributionPanel
          plugin={plugin}
          distribution={open}
          onClose={() => setOpen(null)}
          onChanged={(message, result) => {
            notices.show(message, result);
            void distributions.reload();
          }}
        />
      ) : null}
    </>
  );
};
