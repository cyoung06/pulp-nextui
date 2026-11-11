/** Pages of the UI for Pulp objects. Pages take ids in the query: the export is static. */

import type { PluginKey } from "./plugins";

/** The last path segment of an href: `/pulp/api/v3/tasks/<id>/` → `<id>`. */
export const idOf = (href: string): string => href.replace(/\/+$/, "").split("/").pop() ?? "";

export const taskPagePath = (href: string): string => `/tasks/task?id=${encodeURIComponent(idOf(href))}`;

export const repositoryPagePath = (plugin: PluginKey, kind: string, href: string): string =>
  `/${plugin}/repository?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(idOf(href))}`;

export const userPagePath = (href: string): string => `/access/users/user?id=${encodeURIComponent(idOf(href))}`;

export const groupPagePath = (href: string): string => `/access/groups/group?id=${encodeURIComponent(idOf(href))}`;

export const rolePagePath = (href: string): string => `/access/roles/role?id=${encodeURIComponent(idOf(href))}`;
