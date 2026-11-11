"use client";

import { useSession } from "@/components/session/session-context";
import { ErrorText } from "@/components/ui/error-text";
import { Icon } from "@/components/ui/icon";
import { LetterTile } from "@/components/ui/letter-tile";
import { MenuItem } from "@/components/ui/menu-item";
import { Popover } from "@/components/ui/popover";
import { useAction } from "@/lib/hooks/use-action";
import { signOut } from "@/lib/session/session";

export const UserMenu = () => {
  const { user } = useSession();
  const action = useAction();
  return (
    <Popover
      side="top"
      align="start"
      trigger={
        <button
          type="button"
          className="flex h-7 max-w-full items-center gap-2 rounded-md px-1.5 text-[13px] text-foreground-secondary hover:bg-background-tertiary hover:text-foreground"
          aria-label="Account"
        >
          <LetterTile letter={user.username} size="small" className="rounded-full" />
          <span className="truncate">{user.username}</span>
        </button>
      }
    >
      {() => (
        <div className="flex w-[240px] flex-col">
          <div className="border-b border-border px-3 py-2">
            <div className="truncate text-[13px] font-medium text-foreground">{user.username}</div>
            <div className="text-xs text-foreground-tertiary">Signed in to Pulp</div>
          </div>
          <div className="flex flex-col p-1">
            <MenuItem
              as="button"
              disabled={action.pending}
              onClick={() =>
                void action.run(signOut).then((done) => {
                  if (done) {
                    // A fresh load starts the session gate again: it shows the sign-in card.
                    window.location.reload();
                  }
                })
              }
            >
              <Icon name="arrow-left" size={14} className="text-foreground-tertiary" /> Sign out
            </MenuItem>
            <ErrorText message={action.error} className="m-1" />
          </div>
        </div>
      )}
    </Popover>
  );
};
