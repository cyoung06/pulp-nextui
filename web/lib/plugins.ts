import type { IconName } from "@/components/ui/icon";
import type { Distribution } from "@/lib/api/types";

/**
 * The content types the UI knows. Each is shown only when Pulp reports its plugin (by
 * component name in /status/). Paths are relative to the API base.
 */

export type PluginKey = "python" | "npm" | "maven" | "container";

export type RepositoryKind = {
  /** Query value for the kind; the first kind of a plugin is the default. */
  readonly key: string;
  readonly label: string;
  readonly path: string;
  /** The repository can sync from a remote. */
  readonly sync: boolean;
  /** Created through the API (container push repositories are created by `docker push`). */
  readonly creatable: boolean;
  readonly deletable: boolean;
};

export type Snippet = { readonly title: string; readonly language: string; readonly code: string };

/** Where a distribution's snippets point. */
export type UsageContext = {
  /** Pulp's content origin (/status/ content_settings), where clients download from. */
  readonly contentOrigin: string;
  /** The origin of Pulp's API: where uploads go (npm publish, mvn deploy). The UI is served from it. */
  readonly apiOrigin: string;
  /** The name of the repository the distribution serves, once known. */
  readonly repositoryName: string | null;
};

export type Plugin = {
  readonly key: PluginKey;
  readonly label: string;
  /** Pulp's component name in /status/ versions. */
  readonly component: string;
  readonly icon: IconName;
  readonly description: string;
  readonly repositoryKinds: readonly RepositoryKind[];
  readonly distributions: string;
  readonly remotes: string;
  readonly remotePolicies: readonly string[];
  /** Distributions can fetch what they miss from a remote (pull-through caching). */
  readonly pullThrough: boolean;
  /** How files are added to a repository from the browser, if they can be. */
  readonly upload: "python" | "npm" | "maven" | null;
  readonly usage: (distribution: Distribution, context: UsageContext) => readonly Snippet[];
};

const withSlash = (url: string): string => (url.endsWith("/") ? url : `${url}/`);

const baseUrlOf = (distribution: Distribution, origin: string, prefix: string): string =>
  withSlash(distribution.base_url ?? `${origin}${prefix}${distribution.base_path}`);

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export const plugins: readonly Plugin[] = [
  {
    key: "python",
    label: "Python",
    component: "python",
    icon: "package",
    description: "PyPI indexes: host your own packages and mirror or cache pypi.org.",
    repositoryKinds: [
      { key: "python", label: "Repositories", path: "repositories/python/python/", sync: true, creatable: true, deletable: true },
    ],
    distributions: "distributions/python/pypi/",
    remotes: "remotes/python/python/",
    remotePolicies: ["on_demand", "immediate", "streamed"],
    pullThrough: true,
    upload: "python",
    usage: (distribution, { contentOrigin }) => {
      const base = baseUrlOf(distribution, contentOrigin, "/pypi/");
      const snippets: Snippet[] = [
        { title: "pip", language: "sh", code: `pip install --index-url ${base}simple/ <package>` },
        { title: "pip.conf", language: "ini", code: `[global]\nindex-url = ${base}simple/` },
        {
          title: "uv",
          language: "toml",
          code: `[[tool.uv.index]]\nname = "${distribution.name}"\nurl = "${base}simple/"\ndefault = true`,
        },
      ];
      if (distribution.allow_uploads !== false && distribution.repository) {
        snippets.push({
          title: "twine",
          language: "sh",
          code: `twine upload --repository-url ${base}legacy/ -u <username> dist/*`,
        });
      }
      return snippets;
    },
  },
  {
    key: "npm",
    label: "npm",
    component: "npm",
    icon: "box",
    description: "npm registries: publish your own packages and cache registry.npmjs.org.",
    repositoryKinds: [
      { key: "npm", label: "Repositories", path: "repositories/npm/npm/", sync: true, creatable: true, deletable: true },
    ],
    distributions: "distributions/npm/npm/",
    remotes: "remotes/npm/npm/",
    remotePolicies: ["immediate", "on_demand", "streamed"],
    pullThrough: true,
    upload: "npm",
    usage: (distribution, { contentOrigin, apiOrigin }) => {
      // Installs read the content app (base_url); publishing is an API view at /npm/<base_path>/.
      const base = baseUrlOf(distribution, contentOrigin, "/pulp/content/");
      const publish = `${apiOrigin}/npm/${distribution.base_path}/`;
      const scoped = publish.replace(/^https?:/, "");
      return [
        { title: "npm install", language: "sh", code: `npm install --registry ${base} <package>` },
        { title: ".npmrc", language: "ini", code: `registry=${base}` },
        {
          title: "npm publish",
          language: "sh",
          code: `# ~/.npmrc: base64 of "<username>:<password>"\n${scoped}:_auth=<base64>\n\nnpm publish --registry ${publish}`,
        },
      ];
    },
  },
  {
    key: "maven",
    label: "Maven",
    component: "maven",
    icon: "coffee",
    description: "Maven repositories: deploy artifacts and cache Maven Central.",
    repositoryKinds: [
      { key: "maven", label: "Repositories", path: "repositories/maven/maven/", sync: false, creatable: true, deletable: true },
    ],
    distributions: "distributions/maven/maven/",
    remotes: "remotes/maven/maven/",
    remotePolicies: ["immediate"],
    pullThrough: true,
    upload: "maven",
    usage: (distribution, { contentOrigin, apiOrigin, repositoryName }) => {
      const base = baseUrlOf(distribution, contentOrigin, "/pulp/content/");
      const snippets: Snippet[] = [
        {
          title: "pom.xml",
          language: "xml",
          code: `<repositories>\n  <repository>\n    <id>${distribution.name}</id>\n    <url>${base}</url>\n  </repository>\n</repositories>`,
        },
        {
          title: "Gradle",
          language: "kotlin",
          code: `repositories {\n    maven { url = uri("${base}") }\n}`,
        },
        {
          title: "Mirror of Central",
          language: "xml",
          code: `<mirrors>\n  <mirror>\n    <id>${distribution.name}</id>\n    <mirrorOf>central</mirrorOf>\n    <url>${base}</url>\n  </mirror>\n</mirrors>`,
        },
      ];
      if (repositoryName) {
        // mvn deploy PUTs to the API's deploy view, addressed by repository name.
        const deploy = `${apiOrigin}/pulp/maven/${repositoryName}/`;
        snippets.push(
          {
            title: "mvn deploy",
            language: "xml",
            code: `<distributionManagement>\n  <repository>\n    <id>pulp</id>\n    <url>${deploy}</url>\n  </repository>\n</distributionManagement>`,
          },
          {
            title: "Deploy credentials",
            language: "xml",
            code: `<servers>\n  <server>\n    <id>pulp</id>\n    <username><username></username>\n    <password><password></password>\n  </server>\n</servers>`,
          },
        );
      }
      return snippets;
    },
  },
  {
    key: "container",
    label: "Containers",
    component: "container",
    icon: "container",
    description: "An OCI registry: push images with docker or podman, and mirror upstream registries.",
    repositoryKinds: [
      { key: "push", label: "Pushed", path: "repositories/container/container-push/", sync: false, creatable: false, deletable: false },
      { key: "sync", label: "Mirrors", path: "repositories/container/container/", sync: true, creatable: true, deletable: true },
    ],
    distributions: "distributions/container/container/",
    remotes: "remotes/container/container/",
    remotePolicies: ["on_demand", "immediate", "streamed"],
    pullThrough: false,
    upload: null,
    usage: (distribution, { contentOrigin }) => {
      const path = distribution.registry_path ?? `${hostOf(contentOrigin)}/${distribution.base_path}`;
      const host = path.split("/")[0];
      return [
        { title: "Sign in", language: "sh", code: `docker login ${host}` },
        { title: "Pull", language: "sh", code: `docker pull ${path}:<tag>` },
        { title: "Push", language: "sh", code: `docker tag <image> ${path}:<tag>\ndocker push ${path}:<tag>` },
      ];
    },
  },
];

/**
 * How a tool signs in with a username and secret (a member's CLI secret or a robot's), for a
 * distribution of the plugin. Secrets are written into the snippets as given: they are shown once.
 */
export const credentialSnippets = (
  plugin: Plugin,
  distribution: Distribution,
  context: UsageContext,
  username: string,
  secret: string,
): readonly Snippet[] => {
  const encoded = (value: string) => encodeURIComponent(value);
  const basic = typeof btoa === "function" ? btoa(`${username}:${secret}`) : "";
  switch (plugin.key) {
    case "python": {
      const base = withSlash(distribution.base_url ?? `${context.contentOrigin}/pypi/${distribution.base_path}`);
      const authed = base.replace(/^(https?:\/\/)/, `$1${encoded(username)}:${encoded(secret)}@`);
      return [
        { title: "pip", language: "sh", code: `pip install --index-url ${authed}simple/ <package>` },
        { title: "twine", language: "sh", code: `twine upload --repository-url ${base}legacy/ -u '${username}' -p '${secret}' dist/*` },
      ];
    }
    case "npm": {
      const install = withSlash(distribution.base_url ?? `${context.contentOrigin}/pulp/content/${distribution.base_path}`);
      const publish = `${context.apiOrigin}/npm/${distribution.base_path}/`;
      return [
        {
          title: ".npmrc",
          language: "ini",
          code: `registry=${install}\n${install.replace(/^https?:/, "")}:_auth=${basic}\n${publish.replace(/^https?:/, "")}:_auth=${basic}`,
        },
      ];
    }
    case "maven":
      return [
        {
          title: "~/.m2/settings.xml",
          language: "xml",
          // One per <id>: "${distribution.name}" for downloads (pom.xml), "pulp" for mvn deploy.
          code: [distribution.name, "pulp"]
            .map((id) => `  <server>\n    <id>${id}</id>\n    <username>${username}</username>\n    <password>${secret}</password>\n  </server>`)
            .join("\n")
            .replace(/^/, "<servers>\n")
            .concat("\n</servers>"),
        },
      ];
    default:
      return [];
  }
};

export const pluginByKey = (key: string): Plugin | undefined => plugins.find((plugin) => plugin.key === key);

export const pluginKeys = plugins.map((plugin) => plugin.key);

/** The repository kind named by `?kind=`, or the plugin's first. */
export const repositoryKindOf = (plugin: Plugin, key: string | null): RepositoryKind =>
  plugin.repositoryKinds.find((kind) => kind.key === key) ?? plugin.repositoryKinds[0];

/** Which plugin and kind an href (`/pulp/api/v3/repositories/python/python/<id>/`) belongs to. */
export const repositoryKindOfHref = (href: string): { plugin: Plugin; kind: RepositoryKind } | null => {
  for (const plugin of plugins) {
    for (const kind of plugin.repositoryKinds) {
      if (href.includes(`/${kind.path}`)) {
        return { plugin, kind };
      }
    }
  }
  return null;
};
