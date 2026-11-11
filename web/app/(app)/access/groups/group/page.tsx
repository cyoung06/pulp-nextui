import { Suspense } from "react";

import { GroupDetail } from "@/components/access/group-detail";

export default function Page() {
  return (
    <Suspense>
      <GroupDetail />
    </Suspense>
  );
}
