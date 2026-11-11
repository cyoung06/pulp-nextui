/**
 * pulp-nextui's own helper API (/ui/api/), for what Pulp lets only admins do: a member's CLI secret
 * and robot accounts. Pulp still authenticates every call (the helper asks Pulp who the session
 * belongs to and what it may do).
 */

import { request } from "./http";

export type Robot = {
  readonly id: number;
  readonly username: string;
  readonly name: string;
  readonly repository: string;
  readonly active: boolean;
  readonly expires?: string;
  readonly created: string;
};

export type Secret = { readonly username: string; readonly secret: string };

const base = "/ui/api/";

export const newCliSecret = (): Promise<Secret> => request<Secret>("POST", `${base}cli-secret`, { body: { json: {} } });

export const listRobots = (repository: string): Promise<readonly Robot[]> =>
  request<readonly Robot[]>("GET", `${base}robots`, { query: { repository } });

export const createRobot = (input: {
  readonly repository: string;
  readonly name: string;
  readonly expires: string;
  readonly pull: boolean;
  readonly push: boolean;
}): Promise<{ readonly robot: Robot; readonly secret: string; readonly privateDistributions: number }> =>
  request("POST", `${base}robots`, { body: { json: input } });

export const regenerateRobot = (id: number): Promise<{ readonly robot: Robot; readonly secret: string }> =>
  request("POST", `${base}robots/${id}/secret`, { body: { json: {} } });

export const changeRobot = (id: number, change: { readonly active?: boolean; readonly expires?: string }): Promise<Robot> =>
  request("PATCH", `${base}robots/${id}`, { body: { json: change } });

export const deleteRobot = (id: number): Promise<unknown> => request("DELETE", `${base}robots/${id}`);
