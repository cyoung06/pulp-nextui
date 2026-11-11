import { Suspense } from "react";

import { UserDetail } from "@/components/access/user-detail";

export default function Page() {
  return (
    <Suspense>
      <UserDetail />
    </Suspense>
  );
}
