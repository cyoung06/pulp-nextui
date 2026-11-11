import { Suspense } from "react";

import { RoleDetail } from "@/components/access/role-detail";

export default function Page() {
  return (
    <Suspense>
      <RoleDetail />
    </Suspense>
  );
}
