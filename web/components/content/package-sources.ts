/**
 * How each plugin's content becomes packages, releases and files, the way PyPI shows a project:
 * Pulp lists content per unit (a Python file, an npm tarball, a Maven file); the UI groups them.
 */

import type { Distribution } from "@/lib/api/types";
import type { PluginKey } from "@/lib/plugins";

export type ContentUnit = {
  readonly href: string;
  /** The package's key (normalized) and its name as shown. */
  readonly key: string;
  readonly name: string;
  /** Shown under the name, e.g. a Maven groupId. */
  readonly namespace?: string;
  readonly version: string;
  readonly file: string;
  readonly kind?: string;
  readonly size?: number;
  readonly created?: string;
  readonly summary?: string | null;
  /** Facts about the release, e.g. Requires-Python, License. */
  readonly facts?: readonly (readonly [string, string])[];
};

export type PackageSource = {
  readonly path: string;
  readonly fields: string;
  readonly unit: (item: Record<string, unknown>) => ContentUnit;
  /** A snippet that installs one release, given the distribution serving the repository. */
  readonly install: (unit: ContentUnit, distribution: Distribution, contentOrigin: string) => string;
  readonly installTitle: string;
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const withSlash = (url: string): string => (url.endsWith("/") ? url : `${url}/`);

/** PEP 503: Foo_Bar.baz → foo-bar-baz. */
const normalizePython = (name: string): string => name.toLowerCase().replace(/[-_.]+/g, "-");

const pythonKinds: Readonly<Record<string, string>> = { bdist_wheel: "wheel", sdist: "sdist", bdist_egg: "egg" };

export const packageSources: Readonly<Partial<Record<PluginKey, PackageSource>>> = {
  python: {
    path: "content/python/packages/",
    fields:
      "pulp_href,name,version,filename,packagetype,python_version,size,summary,requires_python,license,license_expression,author,pulp_created",
    unit: (item) => ({
      href: text(item.pulp_href),
      key: normalizePython(text(item.name)),
      name: text(item.name),
      version: text(item.version),
      file: text(item.filename),
      kind: pythonKinds[text(item.packagetype)] ?? text(item.packagetype),
      size: typeof item.size === "number" ? item.size : undefined,
      created: text(item.pulp_created),
      summary: text(item.summary) || null,
      facts: [
        ["Requires Python", text(item.requires_python)],
        ["License", text(item.license_expression) || text(item.license).split("\n")[0].slice(0, 80)],
        ["Author", text(item.author)],
      ].filter(([, value]) => value) as [string, string][],
    }),
    installTitle: "pip",
    install: (unit, distribution, origin) =>
      `pip install --index-url ${withSlash(distribution.base_url ?? `${origin}/pypi/${distribution.base_path}`)}simple/ ${unit.name}==${unit.version}`,
  },
  npm: {
    path: "content/npm/packages/",
    fields: "pulp_href,name,version,relative_path,pulp_created",
    unit: (item) => ({
      href: text(item.pulp_href),
      key: text(item.name),
      name: text(item.name),
      version: text(item.version),
      file: text(item.relative_path).split("/").pop() || `${text(item.name)}-${text(item.version)}.tgz`,
      kind: "tarball",
      created: text(item.pulp_created),
    }),
    installTitle: "npm",
    install: (unit, distribution, origin) =>
      `npm install --registry ${withSlash(distribution.base_url ?? `${origin}/pulp/content/${distribution.base_path}`)} ${unit.name}@${unit.version}`,
  },
  maven: {
    path: "content/maven/artifact/",
    fields: "pulp_href,group_id,artifact_id,version,filename,pulp_created",
    unit: (item) => {
      const file = text(item.filename);
      const extension = /\.([a-z0-9]+)(\.(asc|md5|sha1|sha256|sha512))?$/i.exec(file);
      return {
        href: text(item.pulp_href),
        key: `${text(item.group_id)}:${text(item.artifact_id)}`,
        name: text(item.artifact_id),
        namespace: text(item.group_id),
        version: text(item.version),
        file,
        kind: extension ? (extension[3] ? `${extension[1]}.${extension[3]}` : extension[1]) : undefined,
        created: text(item.pulp_created),
      };
    },
    installTitle: "Maven dependency",
    install: (unit) =>
      `<dependency>\n  <groupId>${unit.namespace}</groupId>\n  <artifactId>${unit.name}</artifactId>\n  <version>${unit.version}</version>\n</dependency>`,
  },
};

export type Release = {
  readonly version: string;
  readonly units: readonly ContentUnit[];
  readonly created: string;
};

export type PackageEntry = {
  readonly key: string;
  readonly name: string;
  readonly namespace?: string;
  readonly summary: string | null;
  /** Newest first. */
  readonly releases: readonly Release[];
  readonly updated: string;
};

const versionOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Releases newest first: by version, numerically ("1.10" after "1.9"). */
const byVersionDescending = (a: Release, b: Release): number => versionOrder.compare(b.version, a.version);

export const groupUnits = (units: readonly ContentUnit[]): readonly PackageEntry[] => {
  const packages = new Map<string, Map<string, ContentUnit[]>>();
  for (const unit of units) {
    const releases = packages.get(unit.key) ?? new Map<string, ContentUnit[]>();
    releases.set(unit.version, [...(releases.get(unit.version) ?? []), unit]);
    packages.set(unit.key, releases);
  }
  return [...packages.entries()]
    .map(([key, releases]) => {
      const list = [...releases.entries()]
        .map(([version, files]) => ({
          version,
          units: [...files].sort((a, b) => a.file.localeCompare(b.file)),
          created: files.reduce((latest, file) => ((file.created ?? "") > latest ? (file.created ?? "") : latest), ""),
        }))
        .sort(byVersionDescending);
      const first = list[0].units[0];
      return {
        key,
        name: first.name,
        namespace: first.namespace,
        summary: list.flatMap((release) => release.units).find((unit) => unit.summary)?.summary ?? null,
        releases: list,
        updated: list.reduce((latest, release) => (release.created > latest ? release.created : latest), ""),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || (a.namespace ?? "").localeCompare(b.namespace ?? ""));
};
