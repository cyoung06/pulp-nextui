"use client";

import { useCallback, useEffect, useState } from "react";

import { messageOf } from "@/lib/errors";

type ResourceState<Data> = {
  readonly data: Data | null;
  readonly error: string | null;
};

export type Resource<Data> = ResourceState<Data> & {
  readonly reload: () => Promise<void>;
};

/**
 * Something fetched from the API. There is no polling: it is fetched when the
 * component mounts and when the window regains focus, and the caller calls
 * `reload` after an action and from its Refresh button. `load` must be stable
 * (a module-level function or `useCallback`).
 */
export const useResource = <Data,>(load: () => Promise<Data>): Resource<Data> => {
  const [state, setState] = useState<ResourceState<Data>>({ data: null, error: null });

  const reload = useCallback(async () => {
    try {
      const data = await load();
      setState({ data, error: null });
    } catch (error) {
      setState((previous) => ({ data: previous.data, error: messageOf(error) }));
    }
  }, [load]);

  useEffect(() => {
    const refetch = () => {
      void reload();
    };
    refetch();
    window.addEventListener("focus", refetch);
    return () => window.removeEventListener("focus", refetch);
  }, [reload]);

  return { ...state, reload };
};
