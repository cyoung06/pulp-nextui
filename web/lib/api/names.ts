"use client";

import { useEffect, useState } from "react";

import { get } from "./http";

/**
 * Names for hrefs shown in tables (a distribution's repository, a repository's remote). Each
 * href is fetched once per page load; a repository version is named "<repository> v<number>".
 */
const cache = new Map<string, Promise<string>>();

const versionPattern = /\/versions\/(\d+)\/$/;

export const nameOf = (href: string): Promise<string> => {
  let pending = cache.get(href);
  if (!pending) {
    const version = versionPattern.exec(href);
    pending = version
      ? nameOf(href.slice(0, href.length - version[0].length + 1)).then((name) => `${name} v${version[1]}`)
      : get<{ name?: string; username?: string }>(href, { fields: "name,username" })
          .then((object) => object.name ?? object.username ?? href)
          .catch(() => href.replace(/\/+$/, "").split("/").slice(-2).join("/"));
    cache.set(href, pending);
  }
  return pending;
};

export const useName = (href: string | null | undefined): string | null => {
  const [resolved, setResolved] = useState<{ readonly href: string; readonly name: string } | null>(null);
  useEffect(() => {
    if (!href) {
      return;
    }
    let current = true;
    void nameOf(href).then((name) => {
      if (current) {
        setResolved({ href, name });
      }
    });
    return () => {
      current = false;
    };
  }, [href]);
  return href && resolved?.href === href ? resolved.name : null;
};

/** Forgets cached names, e.g. after a rename. */
export const forgetName = (href: string): void => {
  cache.delete(href);
};
