import type { ReactNode } from "react";

import { PageHeader } from "./page-header";

type SettingsPageProps = {
  readonly title: string;
  readonly icon: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
};

/** A page of sections in one centred column, under the page header. */
export const SettingsPage = ({ title, icon, actions, children }: SettingsPageProps) => (
  <>
    <PageHeader title={title} icon={icon} actions={actions} />
    <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 py-5 md:px-8 md:py-8">{children}</div>
    </div>
  </>
);
