import type { AsyncOperation } from "./types";

/** Pulp answers a change it runs on a worker with `{"task": href}` (202). */
export const taskOf = (result: unknown): string | null =>
  typeof result === "object" && result !== null && "task" in result && typeof (result as AsyncOperation).task === "string"
    ? (result as AsyncOperation).task
    : null;

/** "a, b\nc" → ["a", "b", "c"]. */
export const splitList = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
