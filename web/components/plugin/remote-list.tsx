"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { remove } from "@/lib/api/http";
import type { Remote } from "@/lib/api/types";
import { useList } from "@/lib/hooks/use-list";
import { useTaskNotice } from "@/lib/hooks/use-task-notice";
import { pluginByKey, type PluginKey } from "@/lib/plugins";

import { PluginHeader } from "./plugin-header";
import { RemoteDialog } from "./remote-dialog";

export const RemoteList = ({ pluginKey }: { readonly pluginKey: PluginKey }) => {
  const plugin = pluginByKey(pluginKey)!;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Remote | "new" | null>(null);
  const [deleting, setDeleting] = useState<Remote | null>(null);
  const notices = useTaskNotice();
  const remotes = useList<Remote>(plugin.remotes, { ordering: "name", name__icontains: search });
  const container = plugin.key === "container";

  const columns = [
    { heading: "Name", className: "w-[26%]" },
    { heading: container ? "Upstream" : "URL" },
    { heading: "Policy", className: "w-[120px] hidden sm:table-cell" },
    { heading: "", className: "w-[48px]" },
  ];

  return (
    <>
      <PluginHeader
        plugin={plugin}
        active="remotes"
        actions={
          <>
            <RefreshButton onRefresh={remotes.reload} />
            <Button variant="primary" leadingIcon={<Icon name="plus" size={13} />} onClick={() => setEditing("new")}>
              New remote
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <SearchInput placeholder="Filter by name" onSearch={setSearch} />
      </div>
      {notices.element ? <div className="border-b border-border px-4 py-2">{notices.element}</div> : null}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <ErrorText message={remotes.error} className="m-3" />
        {remotes.data && remotes.data.count === 0 ? (
          <EmptyState
            fill
            icon={<Icon name="link" size={18} />}
            title={search ? "No matching remotes" : "No remotes yet"}
            description="A remote is an upstream source: repositories sync from it, distributions can cache from it."
          />
        ) : (
          <DataTable columns={columns}>
            {remotes.data?.results.map((remote) => (
              <Row key={remote.pulp_href} onClick={() => setEditing(remote)}>
                <Cell>
                  <span className="font-medium">{remote.name}</span>
                </Cell>
                <Cell mono muted className="max-w-0 truncate">
                  {container ? `${remote.url.replace(/\/$/, "")} · ${remote.upstream_name}` : remote.url}
                </Cell>
                <Cell muted className="hidden sm:table-cell">
                  {remote.policy?.replace("_", " ")}
                </Cell>
                <Cell>
                  <IconButton
                    size="compact"
                    tone="subtle-danger"
                    revealOnGroupHover="md:group-hover/row:opacity-100"
                    aria-label={`Delete ${remote.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleting(remote);
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </IconButton>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </div>
      {remotes.data ? (
        <Pagination count={remotes.data.count} offset={remotes.offset} limit={remotes.limit} onChange={remotes.setOffset} />
      ) : null}
      {editing ? (
        <RemoteDialog
          plugin={plugin}
          remote={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            notices.show("Saving the remote.", result);
            void remotes.reload();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body="Repositories and distributions that use it lose it as their remote."
          confirmLabel="Delete"
          onConfirm={() => remove(deleting.pulp_href)}
          onClose={() => setDeleting(null)}
          onDone={(result) => {
            notices.show(`Deleting ${deleting.name}.`, result);
            void remotes.reload();
          }}
        />
      ) : null}
    </>
  );
};
