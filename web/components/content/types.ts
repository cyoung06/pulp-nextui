import type { Repository } from "@/lib/api/types";
import type { Plugin, RepositoryKind } from "@/lib/plugins";

export type ContentViewProps = {
  readonly plugin: Plugin;
  readonly kind: RepositoryKind;
  readonly repository: Repository;
  /** The version whose content is shown; null for an empty repository. */
  readonly versionHref: string | null;
  /** After a change was handed to Pulp (a task), to show and reload. */
  readonly onChanged: (message: string, result: unknown) => void;
};
