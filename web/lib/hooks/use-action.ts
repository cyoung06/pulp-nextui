"use client";

import { useState } from "react";

import { messageOf } from "@/lib/errors";

export type Action = {
  readonly pending: boolean;
  /** The server's message for the last failed run, to show where the action was started. */
  readonly error: string | null;
  /** Resolves to whether the action succeeded. */
  readonly run: (action: () => Promise<unknown>) => Promise<boolean>;
};

export const useAction = (): Action => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (failure) {
      setError(messageOf(failure));
      return false;
    } finally {
      setPending(false);
    }
  };

  return { pending, error, run };
};
