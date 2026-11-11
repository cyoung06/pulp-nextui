"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { classNames } from "@/lib/utilities/class-names";

type TabLinkProps = {
  readonly href: string;
  readonly active: boolean;
  readonly children: ReactNode;
  readonly count?: number | null;
};

export const TabLink = ({ href, active, children, count }: TabLinkProps) => (
  <Link
    href={href}
    aria-current={active ? "page" : undefined}
    className={classNames(
      "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors",
      active
        ? "bg-background-tertiary font-medium text-foreground"
        : "text-foreground-tertiary hover:bg-background-tertiary hover:text-foreground",
    )}
  >
    {children}
    {count !== undefined && count !== null ? (
      <span className="text-2xs tabular-nums text-foreground-quaternary">{count}</span>
    ) : null}
  </Link>
);

type TabButtonProps = {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
  readonly count?: number | null;
};

export const TabButton = ({ active, onClick, children, count }: TabButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={classNames(
      "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors",
      active
        ? "bg-background-tertiary font-medium text-foreground"
        : "text-foreground-tertiary hover:bg-background-tertiary hover:text-foreground",
    )}
  >
    {children}
    {count !== undefined && count !== null ? (
      <span className="text-2xs tabular-nums text-foreground-quaternary">{count}</span>
    ) : null}
  </button>
);
