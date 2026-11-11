/** The parts of Pulp's API objects the UI reads. Field names are Pulp's. */

export type Labels = Readonly<Record<string, string>>;

type Entity = {
  readonly pulp_href: string;
  readonly prn?: string;
  readonly pulp_created?: string;
  readonly pulp_last_updated?: string;
};

export type Repository = Entity & {
  readonly name: string;
  readonly description?: string | null;
  readonly pulp_labels?: Labels;
  readonly latest_version_href?: string | null;
  readonly versions_href?: string;
  readonly retain_repo_versions?: number | null;
  readonly remote?: string | null;
};

export type ContentCounts = Readonly<Record<string, { readonly count: number; readonly href: string }>>;

export type RepositoryVersion = Entity & {
  readonly number: number;
  readonly repository: string;
  readonly base_version?: string | null;
  readonly content_summary: {
    readonly added: ContentCounts;
    readonly removed: ContentCounts;
    readonly present: ContentCounts;
  };
};

export type Distribution = Entity & {
  readonly name: string;
  readonly base_path: string;
  readonly base_url?: string | null;
  readonly repository?: string | null;
  readonly repository_version?: string | null;
  readonly remote?: string | null;
  readonly content_guard?: string | null;
  readonly hidden?: boolean;
  readonly pulp_labels?: Labels;
  /** container */
  readonly registry_path?: string;
  readonly private?: boolean;
  readonly description?: string | null;
  readonly namespace?: string;
  /** python */
  readonly allow_uploads?: boolean;
};

export type Remote = Entity & {
  readonly name: string;
  readonly url: string;
  readonly policy?: string;
  readonly tls_validation?: boolean;
  readonly proxy_url?: string | null;
  readonly hidden_fields?: readonly { readonly name: string; readonly is_set: boolean }[];
  readonly download_concurrency?: number | null;
  /** container */
  readonly upstream_name?: string;
  /** container (tags) and python (project specifiers) */
  readonly includes?: readonly string[] | null;
  readonly excludes?: readonly string[] | null;
  /** python */
  readonly prereleases?: boolean;
  readonly keep_latest_packages?: number;
  readonly package_types?: readonly string[];
};

export type ProgressReport = {
  readonly message: string;
  readonly code: string;
  readonly state: string;
  readonly total: number | null;
  readonly done: number;
  readonly suffix?: string | null;
};

export type TaskState = "waiting" | "skipped" | "running" | "completed" | "failed" | "canceled" | "canceling";

export type Task = Entity & {
  readonly state: TaskState;
  readonly name: string;
  readonly logging_cid: string;
  readonly created_by?: string | null;
  readonly unblocked_at?: string | null;
  readonly started_at?: string | null;
  readonly finished_at?: string | null;
  readonly error?: { readonly description?: string; readonly traceback?: string; readonly [key: string]: unknown } | null;
  readonly parent_task?: string | null;
  readonly child_tasks?: readonly string[];
  readonly task_group?: string | null;
  readonly progress_reports?: readonly ProgressReport[];
  readonly created_resources?: readonly string[];
  readonly reserved_resources_record?: readonly string[];
  readonly result?: unknown;
};

export type AsyncOperation = { readonly task: string };

export type Status = {
  readonly versions: readonly { readonly component: string; readonly version: string; readonly package: string; readonly domain_compatible?: boolean }[];
  readonly online_workers: readonly { readonly name: string; readonly last_heartbeat: string; readonly current_task?: string | null }[];
  readonly online_api_apps: readonly { readonly name: string; readonly last_heartbeat: string }[];
  readonly online_content_apps: readonly { readonly name: string; readonly last_heartbeat: string }[];
  readonly database_connection: { readonly connected: boolean };
  readonly redis_connection?: { readonly connected: boolean } | null;
  readonly storage?: { readonly total: number | null; readonly used: number | null; readonly free: number | null } | null;
  readonly content_settings: { readonly content_origin: string | null; readonly content_path_prefix: string };
  readonly domain_enabled: boolean;
};

export type Login = { readonly pulp_href: string; readonly prn?: string; readonly username: string };

export type User = Entity & {
  readonly id: number;
  readonly username: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly email?: string;
  readonly is_staff: boolean;
  readonly is_active: boolean;
  readonly date_joined: string;
  readonly groups: readonly { readonly name: string; readonly pulp_href: string }[];
  readonly hidden_fields?: readonly { readonly name: string; readonly is_set: boolean }[];
};

export type Group = Entity & { readonly id: number; readonly name: string };

export type Role = Entity & {
  readonly name: string;
  readonly description?: string | null;
  readonly permissions: readonly string[];
  readonly locked: boolean;
};

export type RoleAssignment = Entity & {
  readonly role: string;
  readonly content_object: string | null;
  readonly content_object_prn?: string | null;
  readonly description?: string | null;
  readonly permissions?: readonly string[];
  readonly domain?: string | null;
};

/** One object's role list, as `{href}list_roles/` returns it. */
export type ObjectRoles = {
  readonly roles: readonly { readonly role: string; readonly users: readonly string[]; readonly groups: readonly string[] }[];
};

// Content

export type PythonPackage = Entity & {
  readonly name: string;
  readonly version: string;
  readonly filename: string;
  readonly packagetype: string;
  readonly python_version?: string;
  readonly requires_python?: string | null;
  readonly summary?: string | null;
  readonly size?: number;
  readonly sha256?: string;
  readonly license?: string | null;
  readonly license_expression?: string | null;
  readonly author?: string | null;
  readonly home_page?: string | null;
};

export type NpmPackage = Entity & {
  readonly name: string;
  readonly version: string;
  readonly relative_path?: string;
};

export type MavenPackage = Entity & {
  readonly group_id: string;
  readonly artifact_id: string;
  readonly version: string;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly packaging?: string | null;
  readonly url?: string | null;
};

export type MavenArtifact = Entity & {
  readonly group_id: string;
  readonly artifact_id: string;
  readonly version: string;
  readonly filename: string;
};

export type ContainerTag = Entity & { readonly name: string; readonly tagged_manifest: string };

export type ContainerManifest = Entity & {
  readonly digest: string;
  readonly media_type: string;
  readonly schema_version: number;
  readonly listed_manifests: readonly string[];
  readonly architecture?: string | null;
  readonly os?: string | null;
  readonly compressed_image_size?: number | null;
  readonly type?: string | null;
};
