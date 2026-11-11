/**
 * Calls to Pulp's REST API, made the way pulp-ui makes them: on Pulp's own origin, carrying
 * whatever credentials the browser holds for it. With OIDC that is the Django session cookie
 * Pulp set at sign-in; writes also send the `csrftoken` cookie back as `X-CSRFToken`, which
 * Django requires of session-authenticated requests. Who may do what is Pulp's RBAC: a refusal
 * is shown in Pulp's words where the action was started.
 */

export type Page<Item> = {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly Item[];
};

export type Query = Readonly<Record<string, string | number | boolean | null | undefined>>;

/** Dispatched on `window` when Pulp answers 401: the session is gone. */
export const signedOutEvent = "pulp:signed-out";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let apiBase = "/pulp/api/v3/";

/** Set once from /ui/config.json, before the first call. */
export const setApiBase = (base: string): void => {
  apiBase = base.endsWith("/") ? base : `${base}/`;
};

export const getApiBase = (): string => apiBase;

const csrfToken = (): string | undefined =>
  document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrftoken="))
    ?.slice("csrftoken=".length);

/** A path relative to the API base ("tasks/") or an href Pulp returned ("/pulp/api/v3/tasks/…/"). */
export const apiUrl = (pathOrHref: string, query?: Query): string => {
  const base = pathOrHref.startsWith("/") ? pathOrHref : apiBase + pathOrHref;
  if (!query) {
    return base;
  }
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      parameters.set(key, String(value));
    }
  }
  const text = parameters.toString();
  return text ? `${base}${base.includes("?") ? "&" : "?"}${text}` : base;
};

const flatten = (value: unknown, prefix: string): string[] => {
  if (typeof value === "string") {
    return [prefix ? `${prefix}: ${value}` : value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flatten(item, prefix));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      flatten(item, key === "detail" || key === "non_field_errors" ? prefix : prefix ? `${prefix}.${key}` : key),
    );
  }
  return value === undefined || value === null ? [] : [prefix ? `${prefix}: ${String(value)}` : String(value)];
};

/** Pulp's refusal, word for word: `{"detail": …}`, field errors, or the raw text. */
const refusalMessage = async (response: Response): Promise<string> => {
  const text = await response.text();
  try {
    const lines = flatten(JSON.parse(text) as unknown, "");
    if (lines.length > 0) {
      return lines.join("\n");
    }
  } catch {
    // Not JSON: fall through to the raw text.
  }
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plain.slice(0, 300) || `${response.status} ${response.statusText}`;
};

type Body =
  | { readonly json: unknown }
  | { readonly form: FormData }
  | undefined;

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const request = async <Result>(
  method: Method,
  pathOrHref: string,
  options: { readonly query?: Query; readonly body?: Body } = {},
): Promise<Result> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    // Tells the gateway this is the UI, so it can drop Pulp's `WWW-Authenticate: Basic`
    // from a 401 and the browser does not open its password prompt (see the README).
    "X-Requested-With": "XMLHttpRequest",
  };
  if (method !== "GET") {
    const token = csrfToken();
    if (token) {
      headers["X-CSRFToken"] = token;
    }
  }
  let body: BodyInit | undefined;
  if (options.body && "json" in options.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body.json);
  } else if (options.body && "form" in options.body) {
    body = options.body.form;
  }
  const response = await fetch(apiUrl(pathOrHref, options.query), {
    method,
    headers,
    body,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event(signedOutEvent));
    throw new ApiError(401, "You are signed out. Sign in again.");
  }
  if (!response.ok) {
    const message = await refusalMessage(response);
    throw new ApiError(
      response.status,
      response.status === 403 && /permission|credentials/i.test(message)
        ? `Not allowed: ${message}`
        : message,
    );
  }
  if (response.status === 204) {
    return undefined as Result;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as Result;
};

export const get = <Result>(pathOrHref: string, query?: Query): Promise<Result> =>
  request<Result>("GET", pathOrHref, { query });

export const list = <Item>(pathOrHref: string, query?: Query): Promise<Page<Item>> =>
  request<Page<Item>>("GET", pathOrHref, { query });

/**
 * Every page of a list, up to `cap` items (all by default). For bounded lists: repositories to pick
 * from, roles, groups, and a repository version's content to group by package.
 */
export const listAll = async <Item>(
  pathOrHref: string,
  query?: Query,
  cap = Number.POSITIVE_INFINITY,
): Promise<readonly Item[]> => {
  const items: Item[] = [];
  let next: string | null = apiUrl(pathOrHref, { limit: 200, ...query });
  while (next && items.length < cap) {
    const page: Page<Item> = await request<Page<Item>>("GET", next.replace(/^https?:\/\/[^/]+/, ""));
    items.push(...page.results);
    next = page.next;
  }
  return items;
};

export const post = <Result>(pathOrHref: string, json?: unknown): Promise<Result> =>
  request<Result>("POST", pathOrHref, { body: { json: json ?? {} } });

export const postForm = <Result>(pathOrHref: string, form: FormData): Promise<Result> =>
  request<Result>("POST", pathOrHref, { body: { form } });

export const patch = <Result>(pathOrHref: string, json: unknown): Promise<Result> =>
  request<Result>("PATCH", pathOrHref, { body: { json } });

export const remove = <Result>(pathOrHref: string): Promise<Result> => request<Result>("DELETE", pathOrHref);
