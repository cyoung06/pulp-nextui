"use client";

import { SnippetTabs } from "@/components/plugin/usage-snippets";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import type { Snippet } from "@/lib/plugins";

type SecretDialogProps = {
  readonly title: string;
  readonly username: string;
  readonly secret: string;
  readonly snippets: readonly Snippet[];
  readonly onClose: () => void;
};

/** A secret, shown once: Pulp keeps only its hash. */
export const SecretDialog = ({ title, username, secret, snippets, onClose }: SecretDialogProps) => (
  <Dialog open onClose={onClose} ariaLabel={title} className="max-w-[640px]">
    <h2 className="border-b border-border px-4 py-3 text-[13px] font-medium text-foreground">{title}</h2>
    <div className="scrollbar-thin flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
      <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
        Copy it now. It is not stored anywhere you can read it again; if it is lost, generate a new one.
      </p>
      {[
        ["Username", username],
        ["Secret", secret],
      ].map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-secondary">{label}</span>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background-secondary px-3 py-2">
            <span className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{value}</span>
            <CopyButton value={value} label={label.toLowerCase()} />
          </div>
        </div>
      ))}
      {snippets.length > 0 ? <SnippetTabs snippets={snippets} /> : null}
    </div>
    <div className="flex justify-end border-t border-border px-4 py-3">
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </div>
  </Dialog>
);
