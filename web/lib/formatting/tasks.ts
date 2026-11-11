/** "pulp_python.app.tasks.sync.sync" → { plugin: "python", action: "sync" }. */
export const describeTaskName = (name: string): { readonly plugin: string; readonly action: string } => {
  const parts = name.split(".");
  const plugin = (parts[0] ?? "").replace(/^pulp_?/, "") || "core";
  const action = (parts[parts.length - 1] ?? name).replace(/_/g, " ");
  return { plugin: plugin === "core" || plugin === "pulpcore" ? "core" : plugin, action };
};
