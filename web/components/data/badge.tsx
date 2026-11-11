import type { ReactNode } from "react";

import { classNames } from "@/lib/utilities/class-names";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const toneClasses: Readonly<Record<BadgeTone, string>> = {
  neutral: "border-border bg-background-tertiary text-foreground-secondary",
  accent: "border-accent/30 bg-accent-muted text-accent",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
};

export const Badge = ({ tone = "neutral", children }: { readonly tone?: BadgeTone; readonly children: ReactNode }) => (
  <span
    className={classNames(
      "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded border px-1.5 text-2xs font-medium",
      toneClasses[tone],
    )}
  >
    {children}
  </span>
);
