import { Suspense } from "react";

import { TaskDetail } from "@/components/tasks/task-detail";

export default function TaskPage() {
  return (
    <Suspense>
      <TaskDetail />
    </Suspense>
  );
}
