"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAction } from "@/lib/hooks/use-action";

type RefreshButtonProps = {
  readonly onRefresh: () => Promise<void>;
};

export const RefreshButton = ({ onRefresh }: RefreshButtonProps) => {
  const action = useAction();
  return (
    <Button
      variant="ghost"
      disabled={action.pending}
      onClick={() => void action.run(onRefresh)}
      leadingIcon={<Icon name="refresh" size={13} />}
    >
      Refresh
    </Button>
  );
};
