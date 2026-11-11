"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/data/badge";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { RemoveButton } from "@/components/content/remove-button";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/text-input";
import { get, list, patch, post, remove } from "@/lib/api/http";
import type { Distribution, ObjectRoles } from "@/lib/api/types";
import { useAction } from "@/lib/hooks/use-action";
import { useResource } from "@/lib/hooks/use-resource";
import type { Plugin } from "@/lib/plugins";

const downloader = "core.rbaccontentguard_downloader";

/** Who may download through a private distribution: users and groups with the downloader role on its guard. */
const Downloaders = ({ guard }: { readonly guard: string }) => {
  const load = useCallback(() => get<ObjectRoles>(`${guard}list_roles/`), [guard]);
  const roles = useResource(load);
  const entry = roles.data?.roles.find((role) => role.role === downloader);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"users" | "groups">("users");
  const add = useAction();
  const members = [
    ...(entry?.users ?? []).map((value) => ({ kind: "users" as const, value })),
    ...(entry?.groups ?? []).map((value) => ({ kind: "groups" as const, value })),
  ];
  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3">
      <span className="text-xs font-medium text-foreground-secondary">Who can download</span>
      <ErrorText message={roles.error ?? add.error} />
      {members.length === 0 && roles.data ? (
        <p className="text-xs text-foreground-tertiary">Nobody yet (besides admins). Add users, groups or robots.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {members.map((member) => (
            <li
              key={`${member.kind}-${member.value}`}
              className="group/row flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs"
            >
              <Icon name={member.kind === "users" ? "user" : "users"} size={11} className="text-foreground-tertiary" />
              <span className="font-mono">{member.value}</span>
              <RemoveButton
                what={member.value}
                body="They can no longer download from this distribution."
                onConfirm={() => post(`${guard}remove_role/`, { role: downloader, [member.kind]: [member.value] })}
                onDone={() => void roles.reload()}
              />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add.run(() => post(`${guard}add_role/`, { role: downloader, [kind]: [name.trim()] })).then((done) => {
            if (done) {
              setName("");
              void roles.reload();
            }
          });
        }}
      >
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "users" | "groups")}
          aria-label="User or group"
          className="h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground"
        >
          <option value="users">User</option>
          <option value="groups">Group</option>
        </select>
        <TextInput
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={kind === "users" ? "username or robot+…" : "group name"}
          aria-label="Name to add"
          className="max-w-[260px]"
        />
        <Button type="submit" pending={add.pending} disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
};

type Change = { readonly message: string; readonly result: unknown };

/**
 * Private downloads per distribution: an RBAC content guard on it means the content app serves files
 * only to users with the downloader role on that guard. Deleting the guard makes it public again
 * (Pulp clears a distribution's guard when the guard goes).
 */
export const PrivateDistributions = ({
  plugin,
  repository,
  onChanged,
}: {
  readonly plugin: Plugin;
  readonly repository: string;
  readonly onChanged: (change: Change) => void;
}) => {
  const load = useCallback(
    () => list<Distribution>(plugin.distributions, { repository, ordering: "name" }),
    [plugin.distributions, repository],
  );
  const distributions = useResource(load);
  const toggle = useAction();
  const [publishing, setPublishing] = useState<Distribution | null>(null);

  const makePrivate = (distribution: Distribution) =>
    void toggle.run(async () => {
      const guard = await post<{ pulp_href: string }>("contentguards/core/rbac/", {
        name: `private-${distribution.name}-${Date.now().toString(36)}`,
        description: `Downloads from distribution ${distribution.name} (pulp-nextui)`,
      });
      const result = await patch(distribution.pulp_href, { content_guard: guard.pulp_href });
      onChanged({ message: `Making ${distribution.name} private.`, result });
      await distributions.reload();
    });

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-medium text-foreground">Downloads</h2>
        <p className="mt-0.5 text-xs text-foreground-tertiary">
          A private distribution serves files only to the users, groups and robots you list. Who can see and
          change the repository is set by its roles in Pulp.
          {plugin.key === "python" ? " Package names and versions on the index page stay visible." : ""}
        </p>
      </div>
      <ErrorText message={distributions.error ?? toggle.error} />
      {distributions.data && distributions.data.results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-foreground-tertiary">
          Not served by any distribution.
        </p>
      ) : null}
      {distributions.data?.results.map((distribution) => {
        const guard = distribution.content_guard;
        const isPrivate = Boolean(guard && guard.includes("/contentguards/core/rbac/"));
        return (
          <div key={distribution.pulp_href} className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-3 px-4 py-3">
              <Icon name={isPrivate ? "lock" : "globe"} size={14} className="shrink-0 text-foreground-tertiary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">{distribution.name}</span>
                <span className="block truncate font-mono text-2xs text-foreground-tertiary">
                  {distribution.base_url ?? distribution.base_path}
                </span>
              </span>
              {isPrivate ? <Badge tone="warning">private</Badge> : <Badge tone="success">public</Badge>}
              {guard && !isPrivate ? (
                <span className="text-xs text-foreground-tertiary">guarded by another kind of guard</span>
              ) : isPrivate ? (
                <Button size="small" onClick={() => setPublishing(distribution)}>
                  Make public
                </Button>
              ) : (
                <Button size="small" pending={toggle.pending} onClick={() => makePrivate(distribution)}>
                  Make private
                </Button>
              )}
            </div>
            {isPrivate && guard ? <Downloaders guard={guard} /> : null}
          </div>
        );
      })}
      {publishing?.content_guard ? (
        <ConfirmDialog
          title={`Make ${publishing.name} public?`}
          body="Anyone who can reach it can download from it. Its list of who can download is deleted."
          confirmLabel="Make public"
          onConfirm={() => remove(publishing.content_guard as string)}
          onClose={() => setPublishing(null)}
          onDone={() => void distributions.reload()}
        />
      ) : null}
    </section>
  );
};
