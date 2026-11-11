"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/data/badge";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { LetterTile } from "@/components/ui/letter-tile";
import type { User } from "@/lib/api/types";
import { formatRelative, formatTime } from "@/lib/formatting/dates";
import { useList } from "@/lib/hooks/use-list";
import { userPagePath } from "@/lib/paths";

import { AccessHeader } from "./access-header";
import { UserDialog } from "./user-dialog";

const columns = [
  { heading: "User" },
  { heading: "Email", className: "w-[28%] hidden md:table-cell" },
  { heading: "", className: "w-[140px]" },
  { heading: "Joined", className: "w-[140px] hidden sm:table-cell" },
] as const;

export const UserList = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const users = useList<User>("users/", { ordering: "username", username__icontains: search }, 50);
  return (
    <>
      <AccessHeader
        title="Users"
        icon="user"
        actions={
          <>
            <RefreshButton onRefresh={users.reload} />
            <Button variant="primary" leadingIcon={<Icon name="plus" size={13} />} onClick={() => setCreating(true)}>
              New user
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <SearchInput placeholder="Filter by username" onSearch={setSearch} />
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <ErrorText message={users.error} className="m-3" />
        <DataTable columns={columns}>
          {users.data?.results.map((user) => (
            <Row key={user.pulp_href} onClick={() => router.push(userPagePath(user.pulp_href))}>
              <Cell>
                <div className="flex items-center gap-2.5">
                  <LetterTile letter={user.username} size="medium" className="rounded-full" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{user.username}</div>
                    {user.first_name || user.last_name ? (
                      <div className="truncate text-xs text-foreground-tertiary">
                        {[user.first_name, user.last_name].filter(Boolean).join(" ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Cell>
              <Cell muted className="hidden max-w-0 truncate md:table-cell">
                {user.email}
              </Cell>
              <Cell>
                <div className="flex gap-1">
                  {user.is_staff ? <Badge tone="accent">staff</Badge> : null}
                  {!user.is_active ? <Badge tone="danger">inactive</Badge> : null}
                </div>
              </Cell>
              <Cell muted className="hidden sm:table-cell">
                <span title={formatTime(user.date_joined)}>{formatRelative(user.date_joined)}</span>
              </Cell>
            </Row>
          ))}
        </DataTable>
      </div>
      {users.data ? (
        <Pagination count={users.data.count} offset={users.offset} limit={users.limit} onChange={users.setOffset} />
      ) : null}
      {creating ? (
        <UserDialog onClose={() => setCreating(false)} onSaved={(user) => router.push(userPagePath(user.pulp_href))} />
      ) : null}
    </>
  );
};
