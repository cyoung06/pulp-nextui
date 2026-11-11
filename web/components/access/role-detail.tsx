"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Badge } from "@/components/data/badge";
import { RefreshButton } from "@/components/layout/refresh-button";
import { ErrorText } from "@/components/ui/error-text";
import { get, getApiBase } from "@/lib/api/http";
import type { Role } from "@/lib/api/types";
import { useResource } from "@/lib/hooks/use-resource";

import { AccessHeader } from "./access-header";

/** "python.view_pythonrepository" grouped under "python". */
const grouped = (permissions: readonly string[]): readonly (readonly [string, readonly string[]])[] => {
  const groups = new Map<string, string[]>();
  for (const permission of [...permissions].sort()) {
    const [app, name] = permission.includes(".") ? permission.split(".", 2) : ["", permission];
    groups.set(app, [...(groups.get(app) ?? []), name]);
  }
  return [...groups.entries()];
};

export const RoleDetail = () => {
  const href = `${getApiBase()}roles/${useSearchParams().get("id") ?? ""}/`;
  const load = useCallback(() => get<Role>(href), [href]);
  const role = useResource(load);
  const data = role.data;
  return (
    <>
      <AccessHeader
        breadcrumbs={[
          <Link key="roles" href="/access/roles" className="hover:text-foreground">
            Roles
          </Link>,
        ]}
        title={data ? <span className="font-mono text-xs">{data.name}</span> : "Role"}
        icon="shield"
        actions={<RefreshButton onRefresh={role.reload} />}
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-6 md:px-8">
          <ErrorText message={role.error} />
          {data ? (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-sm font-medium text-foreground">{data.name}</h2>
                  <Badge tone={data.locked ? "neutral" : "accent"}>{data.locked ? "built in" : "custom"}</Badge>
                </div>
                {data.description ? <p className="text-[13px] text-foreground-tertiary">{data.description}</p> : null}
              </div>
              <section className="flex flex-col gap-3">
                <h3 className="text-[13px] font-medium text-foreground">Permissions ({data.permissions.length})</h3>
                <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface">
                  {grouped(data.permissions).map(([app, names]) => (
                    <div key={app} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-4">
                      <span className="w-28 shrink-0 text-xs font-medium text-foreground-secondary">{app || "—"}</span>
                      <div className="flex flex-wrap gap-1">
                        {names.map((name) => (
                          <span
                            key={name}
                            className="rounded bg-background-tertiary px-1.5 py-0.5 font-mono text-2xs text-foreground-secondary"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};
