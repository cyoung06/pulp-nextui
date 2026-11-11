"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { RemoveButton } from "@/components/content/remove-button";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { LetterTile } from "@/components/ui/letter-tile";
import { TextInput } from "@/components/ui/text-input";
import { get, getApiBase, listAll, post, remove } from "@/lib/api/http";
import type { Group, User } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import { useResource } from "@/lib/hooks/use-resource";
import { userPagePath } from "@/lib/paths";

import { AccessHeader } from "./access-header";
import { RoleAssignments } from "./role-assignments";

const Members = ({ group }: { readonly group: Group }) => {
  const usersHref = `${group.pulp_href}users/`;
  const load = useCallback(() => listAll<User>(usersHref), [usersHref]);
  const members = useResource(load);
  const [username, setUsername] = useState("");
  const add = useAction();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-medium text-foreground">Members</h2>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add.run(() => post(usersHref, { username: username.trim() })).then((done) => {
            if (done) {
              setUsername("");
              void members.reload();
            }
          });
        }}
      >
        <TextInput
          value={username}
          placeholder="Username to add"
          aria-label="Username to add"
          className="max-w-[280px]"
          onChange={(event) => setUsername(event.target.value)}
        />
        <Button type="submit" pending={add.pending} disabled={!username.trim()}>
          Add
        </Button>
      </form>
      <ErrorText message={add.error ?? members.error} />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {members.data && members.data.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-foreground-tertiary">No members.</p>
        ) : (
          <DataTable columns={[{ heading: "User" }, { heading: "", className: "w-[48px]" }]} minWidth="min-w-0">
            {members.data?.map((user) => (
              <Row key={user.pulp_href}>
                <Cell>
                  <Link href={userPagePath(user.pulp_href)} className="flex items-center gap-2 hover:underline">
                    <LetterTile letter={user.username} size="small" className="rounded-full" />
                    {user.username}
                  </Link>
                </Cell>
                <Cell>
                  <RemoveButton
                    what={user.username}
                    body={`${user.username} loses the roles this group gives.`}
                    onConfirm={() => remove(`${usersHref}${user.id}/`)}
                    onDone={() => void members.reload()}
                  />
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
};

export const GroupDetail = () => {
  const href = `${getApiBase()}groups/${useSearchParams().get("id") ?? ""}/`;
  const router = useRouter();
  const load = useCallback(() => get<Group>(href), [href]);
  const group = useResource(load);
  const [deleting, setDeleting] = useState(false);
  const data = group.data;
  return (
    <>
      <AccessHeader
        breadcrumbs={[
          <Link key="groups" href="/access/groups" className="hover:text-foreground">
            Groups
          </Link>,
        ]}
        title={data?.name ?? "Group"}
        icon="users"
        actions={
          <>
            <RefreshButton onRefresh={group.reload} />
            {data ? (
              <Button variant="ghost" leadingIcon={<Icon name="trash" size={13} />} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : null}
          </>
        }
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[860px] flex-col gap-8 px-4 py-6 md:px-8">
          <ErrorText message={group.error} />
          {data ? (
            <>
              <Members group={data} />
              <RoleAssignments ownerHref={data.pulp_href} />
            </>
          ) : null}
        </div>
      </div>
      {data && deleting ? (
        <ConfirmDialog
          title={`Delete ${data.name}?`}
          body="Its members lose the roles it gives."
          confirmLabel="Delete"
          onConfirm={() => remove(data.pulp_href)}
          onClose={() => setDeleting(false)}
          onDone={() => router.push("/access/groups")}
        />
      ) : null}
    </>
  );
};
