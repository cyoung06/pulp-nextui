"use client";

import type { ReactNode } from "react";

import { TabLink } from "@/components/data/tab-link";
import { PageHeader } from "@/components/layout/page-header";
import { Icon } from "@/components/ui/icon";
import type { Plugin } from "@/lib/plugins";

type PluginHeaderProps = {
  readonly plugin: Plugin;
  /** A repository kind's key, "distributions" or "remotes". */
  readonly active: string;
  readonly actions?: ReactNode;
};

export const PluginHeader = ({ plugin, active, actions }: PluginHeaderProps) => (
  <PageHeader
    title={plugin.label}
    icon={<Icon name={plugin.icon} size={15} />}
    tabs={
      <>
        {plugin.repositoryKinds.map((kind, index) => (
          <TabLink
            key={kind.key}
            href={index === 0 ? `/${plugin.key}` : `/${plugin.key}?kind=${kind.key}`}
            active={active === kind.key}
          >
            {kind.label}
          </TabLink>
        ))}
        <TabLink href={`/${plugin.key}/distributions`} active={active === "distributions"}>
          Distributions
        </TabLink>
        <TabLink href={`/${plugin.key}/remotes`} active={active === "remotes"}>
          Remotes
        </TabLink>
      </>
    }
    actions={actions}
  />
);
