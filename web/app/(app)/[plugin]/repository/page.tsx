import { Suspense } from "react";

import { RepositoryDetail } from "@/components/plugin/repository-detail";
import { pluginKeys, type PluginKey } from "@/lib/plugins";

export const dynamicParams = false;

export const generateStaticParams = () => pluginKeys.map((plugin) => ({ plugin }));

export default async function Page({ params }: { readonly params: Promise<{ plugin: string }> }) {
  const { plugin } = await params;
  return (
    <Suspense>
      <RepositoryDetail pluginKey={plugin as PluginKey} />
    </Suspense>
  );
}
