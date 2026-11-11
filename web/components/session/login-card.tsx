"use client";

import { ErrorText } from "@/components/ui/error-text";
import { LetterTile } from "@/components/ui/letter-tile";
import { signIn, type UiConfiguration } from "@/lib/session/session";

type LoginCardProps = {
  readonly configuration: UiConfiguration | null;
  /** Why the user is here again: an expired session, an unreachable server. */
  readonly message: string | null;
};

export const LoginCard = ({ configuration, message }: LoginCardProps) => {
  const title = configuration?.title ?? "Pulp";
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background-secondary px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-popover">
        <div className="mb-6 flex items-center gap-3">
          <LetterTile letter={title} size="large" className="rounded-lg" />
          <div>
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
            <p className="text-xs text-foreground-tertiary">Sign in to continue</p>
          </div>
        </div>
        <ErrorText message={message} className="mb-4" />
        <button
          type="button"
          disabled={!configuration}
          onClick={() => configuration && signIn(configuration)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {configuration?.loginProvider ? `Sign in with ${configuration.loginProvider}` : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs text-foreground-quaternary">
          pip, npm, mvn and docker keep using your Pulp username and password.
        </p>
      </div>
    </main>
  );
};
