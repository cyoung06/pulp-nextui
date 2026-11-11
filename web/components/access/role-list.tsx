"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/data/badge";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { TabButton } from "@/components/data/tab-link";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ErrorText } from "@/components/ui/error-text";
import type { Role } from "@/lib/api/types";
import { useList } from "@/lib/hooks/use-list";
import { rolePagePath } from "@/lib/paths";

import { AccessHeader } from "./access-header";

const columns = [
  { heading: "Role", className: "w-[34%]" },
  { heading: "Description" },
  { heading: "Permissions", className: "w-[110px] hidden sm:table-cell" },
] as const;

export const RoleList = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [locked, setLocked] = useState<"" | "true" | "false">("");
  const roles = useList<Role>("roles/", { ordering: "name", name__icontains: search, locked }, 50);
  return (
    <>
      <AccessHeader title="Roles" icon="shield" actions={<RefreshButton onRefresh={roles.reload} />} />
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <SearchInput placeholder="Filter by name, e.g. python" onSearch={setSearch} />
        <span className="flex-1" />
        <TabButton active={locked === ""} onClick={() => setLocked("")}>
          All
        </TabButton>
        <TabButton active={locked === "true"} onClick={() => setLocked("true")}>
          Built in
        </TabButton>
        <TabButton active={locked === "false"} onClick={() => setLocked("false")}>
          Custom
        </TabButton>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <ErrorText message={roles.error} className="m-3" />
        <DataTable columns={columns}>
          {roles.data?.results.map((role) => (
            <Row key={role.pulp_href} onClick={() => router.push(rolePagePath(role.pulp_href))}>
              <Cell>
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs">{role.name}</span>
                  {!role.locked ? <Badge tone="accent">custom</Badge> : null}
                </div>
              </Cell>
              <Cell muted className="max-w-0 truncate">
                {role.description}
              </Cell>
              <Cell muted className="hidden tabular-nums sm:table-cell">
                {role.permissions.length}
              </Cell>
            </Row>
          ))}
        </DataTable>
      </div>
      {roles.data ? (
        <Pagination count={roles.data.count} offset={roles.offset} limit={roles.limit} onChange={roles.setOffset} />
      ) : null}
    </>
  );
};
