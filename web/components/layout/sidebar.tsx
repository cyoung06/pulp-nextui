"use client";

import { useSession } from "@/components/session/session-context";
import { Icon } from "@/components/ui/icon";
import { LetterTile } from "@/components/ui/letter-tile";
import { classNames } from "@/lib/utilities/class-names";

import { SidebarLink } from "./sidebar-link";
import { useSidebar } from "./sidebar-provider";
import { UserMenu } from "./user-menu";

const SectionTitle = ({ children }: { readonly children: string }) => (
  <div className="px-2 pb-1 pt-4 text-2xs font-medium uppercase tracking-wide text-foreground-quaternary">
    {children}
  </div>
);

export const Sidebar = () => {
  const { configuration, plugins } = useSession();
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-overlay md:hidden"
        />
      ) : null}
      <aside
        className={classNames(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] shrink-0 flex-col border-r border-border bg-sidebar transition-transform md:static md:z-auto md:w-[232px] md:max-w-none md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-dialog" : "invisible -translate-x-full md:visible md:shadow-none",
        )}
      >
        <div className="flex h-12 items-center gap-1.5 px-4 text-[13px] font-medium text-foreground md:h-11">
          <LetterTile letter={configuration.title} size="small" className="rounded" />
          <span className="truncate">{configuration.title}</span>
        </div>

        <nav aria-label="Sections" className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
          <div className="flex flex-col gap-px">
            <SidebarLink href="/" exact icon={<Icon name="home" size={15} />}>
              Overview
            </SidebarLink>
            <SidebarLink href="/tasks" icon={<Icon name="activity" size={15} />}>
              Tasks
            </SidebarLink>
          </div>
          {plugins.length > 0 ? (
            <>
              <SectionTitle>Content</SectionTitle>
              <div className="flex flex-col gap-px">
                {plugins.map((plugin) => (
                  <SidebarLink key={plugin.key} href={`/${plugin.key}`} icon={<Icon name={plugin.icon} size={15} />}>
                    {plugin.label}
                  </SidebarLink>
                ))}
              </div>
            </>
          ) : null}
          <SectionTitle>Access</SectionTitle>
          <div className="flex flex-col gap-px">
            <SidebarLink href="/account" icon={<Icon name="key" size={15} />}>
              CLI secret
            </SidebarLink>
            <SidebarLink href="/access/users" icon={<Icon name="user" size={15} />}>
              Users
            </SidebarLink>
            <SidebarLink href="/access/groups" icon={<Icon name="users" size={15} />}>
              Groups
            </SidebarLink>
            <SidebarLink href="/access/roles" icon={<Icon name="shield" size={15} />}>
              Roles
            </SidebarLink>
          </div>
        </nav>

        <div className="flex h-12 items-center gap-1 border-t border-border px-2 md:h-11">
          <UserMenu />
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-tertiary hover:bg-background-tertiary hover:text-foreground md:hidden"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </aside>
    </>
  );
};
