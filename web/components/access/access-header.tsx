import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Icon, type IconName } from "@/components/ui/icon";

export const AccessHeader = ({
  title,
  icon,
  actions,
  breadcrumbs,
}: {
  readonly title: ReactNode;
  readonly icon: IconName;
  readonly actions?: ReactNode;
  readonly breadcrumbs?: readonly ReactNode[];
}) => <PageHeader title={title} icon={<Icon name={icon} size={15} />} actions={actions} breadcrumbs={breadcrumbs} />;
