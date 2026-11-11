import { Suspense } from "react";

import { RemoteList } from "@/components/plugin/remote-list";
import { pluginKeys, type PluginKey } from "@/lib/plugins";

export const dynamicParams = false;

export const generateStaticParams = () => pluginKeys.map((plugin) => ({ plugin }));

export default async function Page({ params }: { readonly params: Promise<{ plugin: string }> }) {
  const { plugin } = await params;
  return (
    <Suspense>
      <RemoteList pluginKey={plugin as PluginKey} />
    </Suspense>
  );
}
