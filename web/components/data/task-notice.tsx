import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { taskPagePath } from "@/lib/paths";

type TaskNoticeProps = {
  readonly message: string;
  readonly taskHref: string;
  readonly onDismiss: () => void;
};

/**
 * Says an action was handed to a Pulp worker as a task. There is no polling: the task page
 * shows how it went (and is fetched again when it is opened or the window regains focus).
 */
export const TaskNotice = ({ message, taskHref, onDismiss }: TaskNoticeProps) => (
  <div
    role="status"
    className="flex items-center gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-foreground"
  >
    <Icon name="clock" size={13} className="shrink-0 text-info" />
    <span className="min-w-0 flex-1">{message}</span>
    <Link href={taskPagePath(taskHref)} className="shrink-0 font-medium text-accent hover:underline">
      View task
    </Link>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className="rounded p-0.5 text-foreground-tertiary hover:bg-background-tertiary hover:text-foreground"
    >
      <Icon name="close" size={12} />
    </button>
  </div>
);
