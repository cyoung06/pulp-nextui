"use client";

import { Cell, DataTable, Row } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { ErrorText } from "@/components/ui/error-text";
import type { ContentCounts, Repository, RepositoryVersion } from "@/lib/api/types";
import { formatRelative, formatTime } from "@/lib/formatting/dates";
import { useList } from "@/lib/hooks/use-list";

const columns = [
  { heading: "Version", className: "w-[90px]" },
  { heading: "Changes" },
  { heading: "Content", className: "w-[30%] hidden md:table-cell" },
  { heading: "Created", className: "w-[150px] hidden sm:table-cell" },
] as const;

/** "python.python" → "python"; counts summed into a short line. */
const summarize = (counts: ContentCounts): string =>
  Object.entries(counts)
    .map(([type, { count }]) => `${count} ${type.split(".").pop()}`)
    .join(", ");

const total = (counts: ContentCounts): number => Object.values(counts).reduce((sum, { count }) => sum + count, 0);

export const VersionList = ({ repository }: { readonly repository: Repository }) => {
  const versions = useList<RepositoryVersion>(repository.versions_href ?? null, { ordering: "-number" }, 25);
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <ErrorText message={versions.error} className="m-3" />
      <div className="scrollbar-thin overflow-x-auto">
        <DataTable columns={columns} minWidth="min-w-[520px]">
          {versions.data?.results.map((version) => {
            const added = total(version.content_summary.added);
            const removed = total(version.content_summary.removed);
            return (
              <Row key={version.pulp_href}>
                <Cell className="font-medium tabular-nums">v{version.number}</Cell>
                <Cell>
                  <span className="text-success tabular-nums">+{added}</span>{" "}
                  <span className="text-danger tabular-nums">−{removed}</span>
                </Cell>
                <Cell muted className="hidden max-w-0 truncate md:table-cell">
                  {summarize(version.content_summary.present) || "empty"}
                </Cell>
                <Cell muted className="hidden sm:table-cell">
                  <span title={formatTime(version.pulp_created)}>{formatRelative(version.pulp_created)}</span>
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      </div>
      {versions.data ? (
        <Pagination count={versions.data.count} offset={versions.offset} limit={versions.limit} onChange={versions.setOffset} />
      ) : null}
    </div>
  );
};
