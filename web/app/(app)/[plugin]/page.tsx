import { Suspense } from "react";

import { RepositoryList } from "@/components/plugin/repository-list";
import { pluginKeys, type PluginKey } from "@/lib/plugins";

export const dynamicParams = false;

export const generateStaticParams = () => pluginKeys.map((plugin) => ({ plugin }));

export default async function Page({ params }: { readonly params: Promise<{ plugin: string }> }) {
  const { plugin } = await params;
  return (
    <Suspense>
      <RepositoryList pluginKey={plugin as PluginKey} />
    </Suspense>
  );
}
