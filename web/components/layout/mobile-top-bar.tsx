"use client";

import { useSession } from "@/components/session/session-context";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { LetterTile } from "@/components/ui/letter-tile";

import { useSidebar } from "./sidebar-provider";

export const MobileTopBar = () => {
  const { setMobileOpen } = useSidebar();
  const { configuration } = useSession();
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-2 md:hidden">
      <IconButton size="touch" tone="secondary" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <Icon name="panel-left" size={18} />
      </IconButton>
      <span className="flex min-w-0 flex-1 items-center gap-2 px-1 text-[13px] font-medium text-foreground">
        <LetterTile letter={configuration.title} size="medium" className="rounded" />
        <span className="truncate">{configuration.title}</span>
      </span>
    </div>
  );
};
