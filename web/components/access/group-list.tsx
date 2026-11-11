"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Cell, DataTable, Row } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { FormField } from "@/components/form/form-field";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/text-input";
import { post } from "@/lib/api/http";
import type { Group } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import { useList } from "@/lib/hooks/use-list";
import { groupPagePath } from "@/lib/paths";

import { AccessHeader } from "./access-header";

const NewGroupDialog = ({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (group: Group) => void }) => {
  const [name, setName] = useState("");
  const action = useAction();
  return (
    <DialogFrame
      title="New group"
      onClose={onClose}
      submitLabel="Create"
      pending={action.pending}
      submitDisabled={!name.trim()}
      error={action.error}
      onSubmit={() => void action.run(async () => onCreated(await post<Group>("groups/", { name: name.trim() })))}
    >
      <FormField label="Name" htmlFor="group-name">
        <TextInput id="group-name" value={name} autoComplete="off" onChange={(event) => setName(event.target.value)} />
      </FormField>
    </DialogFrame>
  );
};

export const GroupList = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const groups = useList<Group>("groups/", { ordering: "name", name__icontains: search }, 50);
  return (
    <>
      <AccessHeader
        title="Groups"
        icon="users"
        actions={
          <>
            <RefreshButton onRefresh={groups.reload} />
            <Button variant="primary" leadingIcon={<Icon name="plus" size={13} />} onClick={() => setCreating(true)}>
              New group
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <SearchInput placeholder="Filter by name" onSearch={setSearch} />
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <ErrorText message={groups.error} className="m-3" />
        {groups.data && groups.data.count === 0 ? (
          <EmptyState
            fill
            icon={<Icon name="users" size={18} />}
            title="No groups"
            description="Give a group roles, then add users to it, instead of giving each user roles."
          />
        ) : (
          <DataTable columns={[{ heading: "Group" }]} minWidth="min-w-0">
            {groups.data?.results.map((group) => (
              <Row key={group.pulp_href} onClick={() => router.push(groupPagePath(group.pulp_href))}>
                <Cell className="font-medium">{group.name}</Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </div>
      {groups.data ? (
        <Pagination count={groups.data.count} offset={groups.offset} limit={groups.limit} onChange={groups.setOffset} />
      ) : null}
      {creating ? (
        <NewGroupDialog onClose={() => setCreating(false)} onCreated={(group) => router.push(groupPagePath(group.pulp_href))} />
      ) : null}
    </>
  );
};
