"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { signedOutEvent } from "@/lib/api/http";
import { messageOf } from "@/lib/errors";
import { startSession, takeReturnPath, type UiConfiguration } from "@/lib/session/session";

import { LoginCard } from "./login-card";
import { SessionContext, type SignedInSession } from "./session-context";

type GateState =
  | { readonly status: "starting" }
  | { readonly status: "signed-out"; readonly configuration: UiConfiguration | null; readonly message: string | null }
  | { readonly status: "signed-in"; readonly session: SignedInSession };

/** Shows the app to a signed-in user and the sign-in card to anyone else. */
export const SessionGate = ({ children }: { readonly children: ReactNode }) => {
  const [state, setState] = useState<GateState>({ status: "starting" });
  const router = useRouter();

  useEffect(() => {
    let current = true;
    void startSession()
      .then((session): GateState => {
        if (!session.user) {
          return { status: "signed-out", configuration: session.configuration, message: null };
        }
        const returnPath = takeReturnPath();
        if (returnPath && returnPath !== "/") {
          router.replace(returnPath);
        }
        return { status: "signed-in", session: { ...session, user: session.user } };
      })
      .catch((error: unknown): GateState => ({ status: "signed-out", configuration: null, message: messageOf(error) }))
      .then((next) => {
        if (current) {
          setState(next);
        }
      });
    const expire = () =>
      setState((previous) =>
        previous.status === "signed-in"
          ? {
              status: "signed-out",
              configuration: previous.session.configuration,
              message: "Your session has ended. Sign in again.",
            }
          : previous,
      );
    window.addEventListener(signedOutEvent, expire);
    return () => {
      current = false;
      window.removeEventListener(signedOutEvent, expire);
    };
  }, [router]);

  useEffect(() => {
    if (state.status !== "starting") {
      const title = state.status === "signed-in" ? state.session.configuration.title : state.configuration?.title;
      if (title) {
        document.title = title;
      }
    }
  }, [state]);

  if (state.status === "starting") {
    return <div className="flex flex-1 items-center justify-center text-xs text-foreground-tertiary">Loading…</div>;
  }
  if (state.status === "signed-out") {
    return <LoginCard configuration={state.configuration} message={state.message} />;
  }
  return <SessionContext.Provider value={state.session}>{children}</SessionContext.Provider>;
};
