import type { ReactNode } from "react";

import { classNames } from "@/lib/utilities/class-names";

export type Column = {
  readonly heading: string;
  /** Classes for the column's cells, e.g. a width or hiding it on small screens. */
  readonly className?: string;
};

type DataTableProps = {
  readonly columns: readonly Column[];
  readonly children: ReactNode;
  readonly minWidth?: string;
};

export const DataTable = ({ columns, children, minWidth = "min-w-[640px]" }: DataTableProps) => (
  <table className={classNames("w-full border-collapse text-left", minWidth)}>
    <thead>
      <tr>
        {columns.map((column, index) => (
          <th
            key={`${column.heading}-${index}`}
            scope="col"
            className={classNames(
              "sticky top-0 z-10 border-b border-border bg-background px-3 py-2 text-2xs font-medium uppercase tracking-wide text-foreground-quaternary first:pl-4 last:pr-4",
              column.className,
            )}
          >
            {column.heading}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

type RowProps = {
  readonly children: ReactNode;
  readonly onClick?: () => void;
};

/** A row; with `onClick` the whole row opens its object (links inside still work on their own). */
export const Row = ({ children, onClick }: RowProps) => (
  <tr
    onClick={onClick}
    className={classNames(
      "group/row border-b border-border-subtle text-[13px] text-foreground",
      onClick ? "cursor-default hover:bg-background-secondary" : undefined,
    )}
  >
    {children}
  </tr>
);

type CellProps = {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly mono?: boolean;
  readonly muted?: boolean;
};

export const Cell = ({ children, className, mono = false, muted = false }: CellProps) => (
  <td
    className={classNames(
      "h-10 px-3 align-middle first:pl-4 last:pr-4",
      mono ? "font-mono text-xs" : undefined,
      muted ? "text-foreground-tertiary" : undefined,
      className,
    )}
  >
    {children}
  </td>
);
