"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/data/badge";
import { Cell, DataTable, Row } from "@/components/data/data-table";
import { SearchInput } from "@/components/data/search-input";
import { CopyButton } from "@/components/ui/copy-button";
import { list, listAll, post } from "@/lib/api/http";
import type { ContainerManifest, ContainerTag, Distribution } from "@/lib/api/types";
import { formatBytes } from "@/lib/formatting/bytes";
import { useList } from "@/lib/hooks/use-list";
import { useResource } from "@/lib/hooks/use-resource";

import { ContentFrame } from "./content-frame";
import { RemoveButton } from "./remove-button";
import type { ContentViewProps } from "./types";

const columns = [
  { heading: "Tag", className: "w-[22%]" },
  { heading: "Digest" },
  { heading: "Platform", className: "w-[140px] hidden md:table-cell" },
  { heading: "Size", className: "w-[90px] hidden sm:table-cell" },
  { heading: "", className: "w-[96px]" },
] as const;

const platformOf = (manifest: ContainerManifest | undefined): string => {
  if (!manifest) {
    return "";
  }
  if (manifest.listed_manifests.length > 0) {
    return `${manifest.listed_manifests.length} platforms`;
  }
  return [manifest.os, manifest.architecture].filter(Boolean).join("/");
};

export const ContainerContent = ({ kind, repository, versionHref, onChanged }: ContentViewProps) => {
  const [search, setSearch] = useState("");
  const tags = useList<ContainerTag>(
    versionHref ? "content/container/tags/" : null,
    { repository_version: versionHref, name: search, ordering: "name" },
    50,
  );
  const manifestHrefs = (tags.data?.results ?? []).map((tag) => tag.tagged_manifest).join(",");
  const loadManifests = useCallback(
    () =>
      manifestHrefs
        ? listAll<ContainerManifest>("content/container/manifests/", { pulp_href__in: manifestHrefs })
        : Promise.resolve([] as readonly ContainerManifest[]),
    [manifestHrefs],
  );
  const manifests = useResource(loadManifests);
  const manifestOf = (href: string) => manifests.data?.find((manifest) => manifest.pulp_href === href);

  // The registry path to pull from: the first distribution serving this repository.
  const loadDistribution = useCallback(
    () =>
      list<Distribution>("distributions/container/container/", { repository: repository.pulp_href, limit: 1 }).then(
        (page) => page.results[0] ?? null,
      ),
    [repository.pulp_href],
  );
  const distribution = useResource(loadDistribution).data;
  const pushed = kind.key === "push";

  return (
    <ContentFrame
      list={tags}
      icon="tag"
      emptyTitle={search ? "No tag by that name" : "No tags"}
      emptyDescription={pushed ? "docker push an image to this repository's distribution." : "Sync from the remote to get tags."}
      toolbar={<SearchInput placeholder="Exact tag" onSearch={setSearch} />}
    >
      <DataTable columns={columns}>
        {tags.data?.results.map((tag) => {
          const manifest = manifestOf(tag.tagged_manifest);
          return (
            <Row key={tag.pulp_href}>
              <Cell>
                <Badge tone="accent">{tag.name}</Badge>
              </Cell>
              <Cell mono muted className="max-w-0 truncate">
                <span title={manifest?.digest}>{manifest?.digest ?? "…"}</span>
              </Cell>
              <Cell muted className="hidden md:table-cell">
                {platformOf(manifest)}
              </Cell>
              <Cell muted className="hidden tabular-nums sm:table-cell">
                {manifest?.compressed_image_size ? formatBytes(manifest.compressed_image_size) : ""}
              </Cell>
              <Cell>
                <div className="flex items-center justify-end gap-1">
                  {distribution?.registry_path ? (
                    <CopyButton value={`docker pull ${distribution.registry_path}:${tag.name}`} label="pull command" />
                  ) : null}
                  {pushed ? (
                    <RemoveButton
                      what={`tag ${tag.name}`}
                      body="The tag is removed in a new repository version; the image stays if other tags point at it."
                      onConfirm={() => post(`${repository.pulp_href}untag/`, { tag: tag.name })}
                      onDone={(result) => onChanged(`Untagging ${tag.name}.`, result)}
                    />
                  ) : null}
                </div>
              </Cell>
            </Row>
          );
        })}
      </DataTable>
    </ContentFrame>
  );
};
