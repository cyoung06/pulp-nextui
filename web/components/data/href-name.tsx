"use client";

import { useName } from "@/lib/api/names";

/** The name of the object at an href, once known; a dash for none. */
export const HrefName = ({ href, fallback = "—" }: { readonly href: string | null | undefined; readonly fallback?: string }) => {
  const name = useName(href);
  if (!href) {
    return <span className="text-foreground-quaternary">{fallback}</span>;
  }
  return name ? <>{name}</> : <span className="text-foreground-quaternary">…</span>;
};
