"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { Details } from "@/components/data/details";
import { HrefName } from "@/components/data/href-name";
import { Badge } from "@/components/data/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { remove } from "@/lib/api/http";
import type { Distribution } from "@/lib/api/types";
import type { Plugin } from "@/lib/plugins";

import { DistributionDialog } from "./distribution-dialog";
import { UsageSnippets } from "./usage-snippets";

type DistributionPanelProps = {
  readonly plugin: Plugin;
  readonly distribution: Distribution;
  readonly onClose: () => void;
  /** After an edit or delete, with Pulp's answer (a task). */
  readonly onChanged: (message: string, result: unknown) => void;
};

/** One distribution: where it is, what it serves, how to use it; Edit and Delete. */
export const DistributionPanel = ({ plugin, distribution, onClose, onChanged }: DistributionPanelProps) => {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const address = distribution.registry_path ?? distribution.base_url ?? distribution.base_path;
  return (
    <>
      <Dialog open onClose={onClose} ariaLabel={distribution.name} className="max-w-[640px]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Icon name="globe" size={14} className="text-foreground-tertiary" />
          <h2 className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{distribution.name}</h2>
          {distribution.private ? <Badge tone="warning">private</Badge> : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-foreground-tertiary hover:bg-background-tertiary hover:text-foreground"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="scrollbar-thin flex min-h-0 flex-col gap-5 overflow-y-auto px-4 py-4">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background-secondary px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{address}</span>
            <CopyButton value={address} label="address" />
          </div>
          <Details
            items={[
              ["Base path", <span key="path" className="font-mono text-xs">{distribution.base_path}</span>],
              ["Repository", distribution.repository ? <HrefName key="repo" href={distribution.repository} /> : null],
              [
                "Version",
                distribution.repository_version ? <HrefName key="version" href={distribution.repository_version} /> : null,
              ],
              ["Pull-through", distribution.remote ? <HrefName key="remote" href={distribution.remote} /> : null],
              ["Description", distribution.description ?? null],
            ]}
          />
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-foreground-secondary">Use it</h3>
            <UsageSnippets plugin={plugin} distribution={distribution} />
          </div>
        </div>
        <div className="flex justify-between gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" leadingIcon={<Icon name="trash" size={13} />} onClick={() => setDeleting(true)}>
            Delete
          </Button>
          <Button leadingIcon={<Icon name="edit" size={13} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </Dialog>
      {editing ? (
        <DistributionDialog
          plugin={plugin}
          distribution={distribution}
          onClose={() => setEditing(false)}
          onSaved={(result) => {
            onChanged(`Updating ${distribution.name}.`, result);
            onClose();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${distribution.name}?`}
          body="It stops being served at once. The repository and its content stay."
          confirmLabel="Delete"
          onConfirm={() => remove(distribution.pulp_href)}
          onClose={() => setDeleting(false)}
          onDone={(result) => {
            onChanged(`Deleting ${distribution.name}.`, result);
            onClose();
          }}
        />
      ) : null}
    </>
  );
};
