"use client";

import { useCallback, useState } from "react";

import { list, type Page, type Query } from "@/lib/api/http";

import { useResource, type Resource } from "./use-resource";

export type PagedList<Item> = Resource<Page<Item>> & {
  readonly offset: number;
  readonly limit: number;
  readonly setOffset: (offset: number) => void;
};

/**
 * One page of a Pulp list. `path` is null while what it depends on is not known yet. The query
 * is compared by value, so callers may build it inline; a new query starts at the first page.
 */
export const useList = <Item,>(path: string | null, query: Query = {}, limit = 25): PagedList<Item> => {
  const key = JSON.stringify(query);
  const [offset, setOffset] = useState(0);
  const [lastKey, setLastKey] = useState(`${path}|${key}`);
  if (lastKey !== `${path}|${key}`) {
    setLastKey(`${path}|${key}`);
    setOffset(0);
  }
  const load = useCallback(
    (): Promise<Page<Item>> =>
      path
        ? list<Item>(path, { ...(JSON.parse(key) as Query), offset, limit })
        : new Promise<Page<Item>>(() => undefined),
    [path, key, offset, limit],
  );
  const resource = useResource(load);
  return { ...resource, offset, limit, setOffset };
};
