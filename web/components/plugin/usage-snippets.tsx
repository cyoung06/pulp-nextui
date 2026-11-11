"use client";

import { useState } from "react";

import { useSession } from "@/components/session/session-context";
import { CopyButton } from "@/components/ui/copy-button";
import { useName } from "@/lib/api/names";
import type { Distribution } from "@/lib/api/types";
import type { Plugin, Snippet } from "@/lib/plugins";
import { classNames } from "@/lib/utilities/class-names";

/** Several snippets as one block: a tab per snippet, one code area, one Copy. */
export const SnippetTabs = ({ snippets }: { readonly snippets: readonly Snippet[] }) => {
  const [active, setActive] = useState(0);
  const snippet = snippets[Math.min(active, snippets.length - 1)];
  if (!snippet) {
    return null;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-1 border-b border-border bg-background-secondary px-1.5 py-1">
        <div role="tablist" className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {snippets.map((item, index) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={item === snippet}
              onClick={() => setActive(index)}
              className={classNames(
                "h-6 shrink-0 whitespace-nowrap rounded px-2 text-xs transition-colors",
                item === snippet
                  ? "bg-background-quaternary font-medium text-foreground"
                  : "text-foreground-tertiary hover:text-foreground",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
        <CopyButton value={snippet.code} label={snippet.title} />
      </div>
      <pre className="whitespace-pre-wrap break-all bg-background px-3 py-2.5 font-mono text-xs leading-5 text-foreground">
        <code>{snippet.code}</code>
      </pre>
    </div>
  );
};

/** Snippets one under another, compact: for a narrow column with room to grow down. */
export const SnippetList = ({ snippets }: { readonly snippets: readonly Snippet[] }) => (
  <div className="flex flex-col gap-2">
    {snippets.map((snippet) => (
      <div key={snippet.title} className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border bg-background-secondary py-1 pl-3 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground-secondary">{snippet.title}</span>
          <CopyButton value={snippet.code} label={snippet.title} />
        </div>
        <pre className="whitespace-pre-wrap break-all bg-background px-3 py-2 font-mono text-xs leading-5 text-foreground">
          <code>{snippet.code}</code>
        </pre>
      </div>
    ))}
  </div>
);

/** How to use a distribution from the plugin's usual tools. */
export const UsageSnippets = ({ plugin, distribution }: { readonly plugin: Plugin; readonly distribution: Distribution }) => {
  const { contentOrigin } = useSession();
  const repositoryName = useName(distribution.repository);
  return (
    <SnippetList
      snippets={plugin.usage(distribution, { contentOrigin, apiOrigin: window.location.origin, repositoryName })}
    />
  );
};
