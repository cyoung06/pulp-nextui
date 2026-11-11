"use client";

import { useState } from "react";

import { TaskNotice } from "@/components/data/task-notice";
import { taskOf } from "@/lib/api/async";

export type TaskNotices = {
  /** Shows the notice if `result` is a dispatched task; returns whether it was. */
  readonly show: (message: string, result: unknown) => boolean;
  readonly element: React.ReactNode;
};

export const useTaskNotice = (): TaskNotices => {
  const [notice, setNotice] = useState<{ readonly message: string; readonly task: string } | null>(null);
  return {
    show: (message, result) => {
      const task = taskOf(result);
      if (task) {
        setNotice({ message, task });
      }
      return task !== null;
    },
    element: notice ? (
      <TaskNotice message={notice.message} taskHref={notice.task} onDismiss={() => setNotice(null)} />
    ) : null,
  };
};
