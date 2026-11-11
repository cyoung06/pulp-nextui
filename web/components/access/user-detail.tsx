"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Badge } from "@/components/data/badge";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Details } from "@/components/data/details";
import { RefreshButton } from "@/components/layout/refresh-button";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { LetterTile } from "@/components/ui/letter-tile";
import { get, getApiBase, remove } from "@/lib/api/http";
import type { User } from "@/lib/api/types";
import { formatTime } from "@/lib/formatting/dates";
import { useResource } from "@/lib/hooks/use-resource";
import { groupPagePath } from "@/lib/paths";

import { AccessHeader } from "./access-header";
import { RoleAssignments } from "./role-assignments";
import { UserDialog } from "./user-dialog";

export const UserDetail = () => {
  const href = `${getApiBase()}users/${useSearchParams().get("id") ?? ""}/`;
  const router = useRouter();
  const load = useCallback(() => get<User>(href), [href]);
  const user = useResource(load);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const data = user.data;
  const hasPassword = data?.hidden_fields?.find((field) => field.name === "password")?.is_set;
  return (
    <>
      <AccessHeader
        breadcrumbs={[
          <Link key="users" href="/access/users" className="hover:text-foreground">
            Users
          </Link>,
        ]}
        title={data?.username ?? "User"}
        icon="user"
        actions={
          <>
            <RefreshButton onRefresh={user.reload} />
            {data ? (
              <>
                <Button variant="ghost" leadingIcon={<Icon name="trash" size={13} />} onClick={() => setDialog("delete")}>
                  Delete
                </Button>
                <Button leadingIcon={<Icon name="edit" size={13} />} onClick={() => setDialog("edit")}>
                  Edit
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[860px] flex-col gap-8 px-4 py-6 md:px-8">
          <ErrorText message={user.error} />
          {data ? (
            <>
              <div className="flex items-center gap-3">
                <LetterTile letter={data.username} size="large" className="rounded-full" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-foreground">{data.username}</h2>
                    {data.is_staff ? <Badge tone="accent">staff</Badge> : null}
                    {!data.is_active ? <Badge tone="danger">inactive</Badge> : null}
                  </div>
                  <p className="truncate text-[13px] text-foreground-tertiary">
                    {[data.first_name, data.last_name].filter(Boolean).join(" ") || data.email || "No name"}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <Details
                  items={[
                    ["Email", data.email || null],
                    ["Joined", formatTime(data.date_joined)],
                    ["Password", hasPassword ? "Set" : "None: tools can't sign in as this user"],
                    [
                      "Groups",
                      data.groups.length > 0 ? (
                        <span key="groups" className="flex flex-wrap gap-1.5">
                          {data.groups.map((group) => (
                            <Link key={group.pulp_href} href={groupPagePath(group.pulp_href)} className="text-accent hover:underline">
                              {group.name}
                            </Link>
                          ))}
                        </span>
                      ) : (
                        "None"
                      ),
                    ],
                  ]}
                />
              </div>
              <RoleAssignments ownerHref={data.pulp_href} />
            </>
          ) : null}
        </div>
      </div>
      {data && dialog === "edit" ? (
        <UserDialog user={data} onClose={() => setDialog(null)} onSaved={() => void user.reload()} />
      ) : null}
      {data && dialog === "delete" ? (
        <ConfirmDialog
          title={`Delete ${data.username}?`}
          body="The user, their roles and their group memberships are deleted. With OIDC, signing in again creates a new user."
          confirmLabel="Delete"
          onConfirm={() => remove(data.pulp_href)}
          onClose={() => setDialog(null)}
          onDone={() => router.push("/access/users")}
        />
      ) : null}
    </>
  );
};
