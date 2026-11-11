"use client";

import type { ReactNode } from "react";

import { Pagination } from "@/components/data/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorText } from "@/components/ui/error-text";
import { Icon, type IconName } from "@/components/ui/icon";
import type { PagedList } from "@/lib/hooks/use-list";

type ContentFrameProps<Item> = {
  readonly list: PagedList<Item>;
  readonly toolbar?: ReactNode;
  readonly icon: IconName;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly children: ReactNode;
};

/** A repository's content: a toolbar, the table, its pages. */
export const ContentFrame = <Item,>({ list, toolbar, icon, emptyTitle, emptyDescription, children }: ContentFrameProps<Item>) => (
  <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
    {toolbar ? <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">{toolbar}</div> : null}
    <ErrorText message={list.error} className="m-3" />
    {list.data && list.data.count === 0 ? (
      <EmptyState icon={<Icon name={icon} size={18} />} title={emptyTitle} description={emptyDescription} />
    ) : (
      <div className="scrollbar-thin overflow-x-auto">{children}</div>
    )}
    {list.data ? (
      <Pagination count={list.data.count} offset={list.offset} limit={list.limit} onChange={list.setOffset} />
    ) : null}
  </div>
);
