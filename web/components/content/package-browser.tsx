"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/data/badge";
import { ConfirmDialog } from "@/components/data/confirm-dialog";
import { useSession } from "@/components/session/session-context";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { list, listAll, post } from "@/lib/api/http";
import type { Distribution } from "@/lib/api/types";
import { formatBytes } from "@/lib/formatting/bytes";
import { formatRelative, formatTime } from "@/lib/formatting/dates";
import { useResource } from "@/lib/hooks/use-resource";
import { classNames } from "@/lib/utilities/class-names";

import { groupUnits, packageSources, type ContentUnit, type PackageEntry, type PackageSource, type Release } from "./package-sources";
import type { ContentViewProps } from "./types";

/** Above this many files the list is cut short (grouping happens in the browser). */
const unitCap = 20000;

type Loaded = { readonly packages: readonly PackageEntry[]; readonly truncated: boolean };

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

type Removal = { readonly title: string; readonly body: string; readonly hrefs: readonly string[]; readonly message: string };

const PackageList = ({
  packages,
  onOpen,
}: {
  readonly packages: readonly PackageEntry[];
  readonly onOpen: (entry: PackageEntry) => void;
}) => {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = packages.filter((entry) => {
    const haystack = `${entry.namespace ?? ""}:${entry.name} ${entry.summary ?? ""}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex h-7 w-full max-w-[320px] items-center gap-1.5 rounded-md border border-border bg-background px-2 focus-within:border-accent">
          <Icon name="search" size={13} className="shrink-0 text-foreground-quaternary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search packages"
            aria-label="Search packages"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground-quaternary"
          />
        </div>
        <span className="ml-auto text-xs tabular-nums text-foreground-quaternary">{plural(shown.length, "package")}</span>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-foreground-tertiary">No package matches.</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {shown.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => onOpen(entry)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-background-secondary"
              >
                <Icon name="package" size={15} className="mt-0.5 shrink-0 text-foreground-tertiary" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">{entry.name}</span>
                    <span className="shrink-0 font-mono text-xs text-foreground-tertiary">{entry.releases[0].version}</span>
                  </span>
                  {entry.namespace ? (
                    <span className="truncate font-mono text-2xs text-foreground-tertiary">{entry.namespace}</span>
                  ) : null}
                  {entry.summary ? <span className="truncate text-xs text-foreground-tertiary">{entry.summary}</span> : null}
                </span>
                <span className="hidden shrink-0 flex-col items-end gap-0.5 text-xs text-foreground-tertiary sm:flex">
                  <span>{plural(entry.releases.length, "release")}</span>
                  <span className="text-foreground-quaternary" title={formatTime(entry.updated)}>
                    {formatRelative(entry.updated)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const FileRow = ({ unit, onRemove }: { readonly unit: ContentUnit; readonly onRemove: () => void }) => (
  <li className="group/row flex items-center gap-3 px-4 py-2 text-[13px]">
    <Icon name="file" size={13} className="shrink-0 text-foreground-quaternary" />
    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={unit.file}>
      {unit.file}
    </span>
    {unit.kind ? <Badge>{unit.kind}</Badge> : null}
    {unit.size !== undefined ? (
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-foreground-tertiary">{formatBytes(unit.size)}</span>
    ) : null}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${unit.file}`}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-foreground-quaternary hover:bg-background-tertiary hover:text-danger md:opacity-0 md:group-hover/row:opacity-100"
    >
      <Icon name="trash" size={13} />
    </button>
  </li>
);

const PackageView = ({
  entry,
  source,
  distribution,
  onBack,
  onRemove,
}: {
  readonly entry: PackageEntry;
  readonly source: PackageSource;
  readonly distribution: Distribution | null;
  readonly onBack: () => void;
  readonly onRemove: (removal: Removal) => void;
}) => {
  const { contentOrigin } = useSession();
  const [selected, setSelected] = useState(entry.releases[0].version);
  const release = entry.releases.find((item) => item.version === selected) ?? entry.releases[0];
  const unit = release.units[0];
  const facts = release.units.find((item) => item.facts && item.facts.length > 0)?.facts ?? [];
  const install = distribution ? source.install(unit, distribution, contentOrigin) : null;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-xs text-foreground-tertiary hover:text-foreground"
      >
        <Icon name="arrow-left" size={12} /> All packages
      </button>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            {entry.namespace ? <div className="font-mono text-xs text-foreground-tertiary">{entry.namespace}</div> : null}
            <h3 className="flex flex-wrap items-baseline gap-2 text-lg font-semibold text-foreground">
              <span className="[overflow-wrap:anywhere]">{entry.name}</span>
              <span className="font-mono text-sm font-normal text-foreground-secondary">{release.version}</span>
              {release.version === entry.releases[0].version ? <Badge tone="success">latest</Badge> : null}
            </h3>
            {entry.summary ? <p className="mt-1 text-[13px] text-foreground-secondary">{entry.summary}</p> : null}
          </div>
          <Button
            variant="ghost"
            size="small"
            leadingIcon={<Icon name="trash" size={12} />}
            onClick={() =>
              onRemove({
                title: `Remove ${entry.name}?`,
                body: `All ${plural(entry.releases.length, "release")} (${plural(entry.releases.reduce((sum, item) => sum + item.units.length, 0), "file")}) leave this repository in a new version.`,
                hrefs: entry.releases.flatMap((item) => item.units.map((file) => file.href)),
                message: `Removing ${entry.name}.`,
              })
            }
          >
            Remove package
          </Button>
        </div>
        {install ? (
          <div className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2">
            <pre className="scrollbar-thin min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-5 text-foreground">{install}</pre>
            <CopyButton value={install} label={`${source.installTitle} command`} />
          </div>
        ) : (
          <p className="text-xs text-foreground-tertiary">Distribute this repository to get an install command.</p>
        )}
        {facts.length > 0 ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {facts.map(([label, value]) => (
              <div key={label} className="flex gap-1.5">
                <dt className="text-foreground-tertiary">{label}</dt>
                <dd className="text-foreground-secondary">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <section className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-foreground-secondary">Release history</h4>
          <ol className="scrollbar-thin flex max-h-[420px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-1">
            {entry.releases.map((item: Release) => (
              <li key={item.version}>
                <button
                  type="button"
                  onClick={() => setSelected(item.version)}
                  aria-current={item.version === release.version ? "true" : undefined}
                  className={classNames(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left",
                    item.version === release.version ? "bg-accent-muted text-foreground" : "hover:bg-background-tertiary",
                  )}
                >
                  <span className="shrink-0 font-mono text-xs text-foreground [overflow-wrap:anywhere]">{item.version}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-2xs text-foreground-quaternary" title={formatTime(item.created)}>
                    {formatRelative(item.created)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <h4 className="flex-1 text-xs font-medium text-foreground-secondary">
              Files of {release.version} <span className="text-foreground-quaternary">({release.units.length})</span>
            </h4>
            <Button
              variant="ghost"
              size="small"
              onClick={() =>
                onRemove({
                  title: `Remove ${entry.name} ${release.version}?`,
                  body: `Its ${plural(release.units.length, "file")} leave this repository in a new version.`,
                  hrefs: release.units.map((file) => file.href),
                  message: `Removing ${entry.name} ${release.version}.`,
                })
              }
            >
              Remove release
            </Button>
          </div>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-surface">
            {release.units.map((file) => (
              <FileRow
                key={file.href}
                unit={file}
                onRemove={() =>
                  onRemove({
                    title: `Remove ${file.file}?`,
                    body: "It leaves this repository in a new version.",
                    hrefs: [file.href],
                    message: `Removing ${file.file}.`,
                  })
                }
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

/** A repository's content grouped by package, then release, then file. */
export const PackageBrowser = ({ plugin, repository, versionHref, onChanged }: ContentViewProps) => {
  const source = packageSources[plugin.key]!;
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const open = query.get("package");

  const load = useCallback(async (): Promise<Loaded> => {
    if (!versionHref) {
      return { packages: [], truncated: false };
    }
    const items = await listAll<Record<string, unknown>>(
      source.path,
      { repository_version: versionHref, fields: source.fields, limit: 1000 },
      unitCap,
    );
    return { packages: groupUnits(items.map(source.unit)), truncated: items.length >= unitCap };
  }, [source, versionHref]);
  const content = useResource(load);

  const loadDistribution = useCallback(
    () =>
      list<Distribution>(plugin.distributions, { repository: repository.pulp_href, limit: 1 }).then(
        (page) => page.results[0] ?? null,
      ),
    [plugin.distributions, repository.pulp_href],
  );
  const distribution = useResource(loadDistribution).data ?? null;
  const [removal, setRemoval] = useState<Removal | null>(null);

  const go = (key: string | null) => {
    const next = new URLSearchParams(query.toString());
    if (key) {
      next.set("package", key);
    } else {
      next.delete("package");
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const entry = useMemo(
    () => (open ? (content.data?.packages.find((item) => item.key === open) ?? null) : null),
    [content.data, open],
  );

  return (
    <div className="flex flex-col gap-3">
      <ErrorText message={content.error} />
      {content.data?.truncated ? (
        <p className="text-xs text-warning">
          Showing the first {unitCap.toLocaleString()} files only; this repository has more.
        </p>
      ) : null}
      {!content.data && !content.error ? (
        <p className="px-1 py-6 text-xs text-foreground-tertiary">Loading packages…</p>
      ) : null}
      {content.data && content.data.packages.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Icon name={plugin.icon} size={18} />} title="No packages" description="This repository version holds no packages." />
        </div>
      ) : null}
      {content.data && content.data.packages.length > 0 ? (
        entry ? (
          <PackageView
            key={entry.key}
            entry={entry}
            source={source}
            distribution={distribution}
            onBack={() => go(null)}
            onRemove={setRemoval}
          />
        ) : (
          <>
            {open ? <p className="text-xs text-foreground-tertiary">No package {open} in this version.</p> : null}
            <PackageList packages={content.data.packages} onOpen={(item) => go(item.key)} />
          </>
        )
      ) : null}
      {removal ? (
        <ConfirmDialog
          title={removal.title}
          body={removal.body}
          confirmLabel="Remove"
          onConfirm={() => post(`${repository.pulp_href}modify/`, { remove_content_units: removal.hrefs })}
          onClose={() => setRemoval(null)}
          onDone={(result) => onChanged(removal.message, result)}
        />
      ) : null}
    </div>
  );
};
