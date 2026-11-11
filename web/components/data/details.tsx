import type { ReactNode } from "react";

/** Label/value pairs in two columns. Empty values are left out. */
export const Details = ({ items }: { readonly items: readonly (readonly [string, ReactNode])[] }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(120px,max-content)_1fr]">
    {items
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-xs text-foreground-tertiary sm:pt-px">{label}</dt>
          <dd className="min-w-0 text-[13px] text-foreground [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
  </dl>
);
