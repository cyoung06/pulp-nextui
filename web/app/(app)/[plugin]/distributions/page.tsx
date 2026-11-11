import { Suspense } from "react";

import { DistributionList } from "@/components/plugin/distribution-list";
import { pluginKeys, type PluginKey } from "@/lib/plugins";

export const dynamicParams = false;

export const generateStaticParams = () => pluginKeys.map((plugin) => ({ plugin }));

export default async function Page({ params }: { readonly params: Promise<{ plugin: string }> }) {
  const { plugin } = await params;
  return (
    <Suspense>
      <DistributionList pluginKey={plugin as PluginKey} />
    </Suspense>
  );
}
