/**
 * Sign-in is Pulp's own: the UI only sends the browser to Pulp's OIDC entry (`loginUrl` in
 * /ui/config.json) and back. Pulp finishes the OpenID Connect login and leaves its Django session
 * cookie, which every API call then carries. `GET login/` says who that is; `DELETE login/` ends
 * the session. sessionStorage holds the page to return to, for the length of one redirect.
 */

import { ApiError, get, remove, setApiBase } from "@/lib/api/http";
import type { Login, Status } from "@/lib/api/types";
import { plugins, type Plugin } from "@/lib/plugins";

/** `/ui/config.json`, as pulp-nextui serves it. */
export type UiConfiguration = {
  /** Shown in the sidebar and the tab title. */
  readonly title: string;
  readonly apiBase: string;
  /** Where "Sign in" goes: Pulp's OIDC entry. The provider's name is shown on the button. */
  readonly loginUrl: string;
  readonly loginProvider: string;
  /** The content types to show; absent: every one Pulp reports. */
  readonly plugins?: readonly string[];
  /** The helper API (/ui/api/) is on: CLI secrets and robot accounts. */
  readonly helper?: boolean;
};

export type Session = {
  readonly configuration: UiConfiguration;
  readonly status: Status;
  /** null: signed out. */
  readonly user: Login | null;
  /** The plugins Pulp reports and the UI knows. */
  readonly plugins: readonly Plugin[];
  /** Where Pulp serves content, for the usage snippets. */
  readonly contentOrigin: string;
};

const returnPathKey = "pulp_nextui_return_path";
export const basePath = "/ui";

const loadConfiguration = async (): Promise<UiConfiguration> => {
  const response = await fetch(`${basePath}/config.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${basePath}/config.json (${response.status}).`);
  }
  return (await response.json()) as UiConfiguration;
};

export const startSession = async (): Promise<Session> => {
  const configuration = await loadConfiguration();
  setApiBase(configuration.apiBase);
  const [status, user] = await Promise.all([
    get<Status>("status/"),
    get<Login>("login/").catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return null;
      }
      throw error;
    }),
  ]);
  const components = new Set(status.versions.map((version) => version.component));
  return {
    configuration,
    status,
    user,
    plugins: plugins.filter(
      (plugin) =>
        components.has(plugin.component) && (!configuration.plugins || configuration.plugins.includes(plugin.key)),
    ),
    contentOrigin: (status.content_settings.content_origin ?? window.location.origin).replace(/\/+$/, ""),
  };
};

/** The page to go back to after a sign-in, once: it is forgotten as it is read. */
export const takeReturnPath = (): string | null => {
  const path = sessionStorage.getItem(returnPathKey);
  sessionStorage.removeItem(returnPathKey);
  return path;
};

export const signIn = (configuration: UiConfiguration): void => {
  const here = window.location.pathname + window.location.search;
  if (here.startsWith(`${basePath}/`) && here !== `${basePath}/`) {
    sessionStorage.setItem(returnPathKey, here.slice(basePath.length));
  }
  window.location.assign(configuration.loginUrl);
};

export const signOut = async (): Promise<void> => {
  await remove("login/");
};
