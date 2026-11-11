"use client";

import { useSession } from "@/components/session/session-context";
import type { Repository } from "@/lib/api/types";
import type { Plugin } from "@/lib/plugins";

import { PrivateDistributions } from "./private-distributions";
import { RobotAccounts } from "./robot-accounts";

/** The Access tab of a repository: private downloads, and (with the helper) robot accounts. */
export const RepositoryAccess = ({
  plugin,
  repository,
  onChanged,
}: {
  readonly plugin: Plugin;
  readonly repository: Repository;
  readonly onChanged: (message: string, result: unknown) => void;
}) => {
  const { configuration } = useSession();
  return (
    <div className="flex flex-col gap-8">
      <PrivateDistributions
        plugin={plugin}
        repository={repository.pulp_href}
        onChanged={({ message, result }) => onChanged(message, result)}
      />
      {configuration.helper ? <RobotAccounts plugin={plugin} repository={repository.pulp_href} /> : null}
    </div>
  );
};
