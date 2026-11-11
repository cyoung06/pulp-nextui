# pulp-nextui

A web UI for [Pulp](https://pulpproject.org), in place of pulp-ui: Python (PyPI), npm, Maven and
container repositories, their distributions and remotes, content browsing and uploads, tasks,
and users, groups and roles. Each distribution shows how to use it from pip, uv, twine, npm,
Maven, Gradle and docker.

It is a Next.js static export served by a small Go binary under `/ui/`, **on the same origin as
Pulp**. It signs in and authorizes the way pulp-ui does:

- **Authentication is Pulp's.** "Sign in" sends the browser to Pulp's own login entry
  (`-login-url`), e.g. the OpenID Connect login of `social-auth-app-django`. Pulp finishes the
  login and sets its Django session cookie; the UI then calls Pulp's REST API with that cookie,
  plus `X-CSRFToken` (from the `csrftoken` cookie) on writes. `GET /pulp/api/v3/login/` says
  who is signed in; `DELETE` on it signs out.
- **Authorization is Pulp's RBAC.** The UI offers every action and shows Pulp's refusal where
  the action was started.

pip, npm, mvn and the pulp CLI keep using Pulp usernames and passwords.

### The helper (optional): CLI secrets and robot accounts

Pulp lets only admins create users and set passwords. With `-pulp` set, pulp-nextui serves a small
helper API under `/ui/api/` that does exactly two kinds of admin work, as a dedicated Pulp superuser:

- **CLI secret**: a new random password for the *caller's own* user, shown once (users signed in
  through OIDC have none, so command-line tools can't authenticate otherwise; like Harbor's).
- **Robot accounts** (`robot+<repository>+<name>`): users scoped to one Python, npm or Maven
  repository, with pull (the downloader role on its distributions' RBAC content guards) and/or push
  (`nextui.<type>.pusher`: view + modify on the repository, nothing else), an optional expiry, and a
  secret shown once.

Pulp authenticates every caller: the browser's own session cookie goes to Pulp's `GET login/`, and
robot management requires that Pulp reports `manage_roles` on the repository (`my_permissions`) for
that session. Requests must be same-origin (`X-Requested-With`, `Origin`, `Sec-Fetch-Site`).

The superuser's credentials are a Kubernetes Secret (`username`, `password`, and `next` during a
rotation) that the helper reads through the API. `pulp-nextui rotate` (run it as a CronJob) changes
the password in repeatable steps (a run that dies anywhere is finished by the next), then disables
robots past their expiry. Give the helper `get` and the rotate job `get`/`update` on that one Secret.

## Running it

```sh
pulp-nextui -login-url '/idp-launch/oidc/?iss=https://sso.example.org/realms/main' -login-provider Keycloak
```

| Flag | Default | |
| --- | --- | --- |
| `-listen` | `:8080` | plain HTTP; TLS terminates in front |
| `-login-url` | (required) | where "Sign in" goes |
| `-login-provider` | | name on the button ("Sign in with …") |
| `-title` | `Pulp` | sidebar and tab title |
| `-api-base` | `/pulp/api/v3/` | Pulp's API path on this origin |
| `-plugins` | all Pulp has | content types to show, e.g. `python,npm,maven` |
| `-pulp` | (off) | Pulp's API in the cluster, e.g. `http://pulp-api-svc:24817`: turns the helper on |
| `-credentials-secret` | | `namespace/name` of the helper's Secret |
| `-origin` | | the public origin; helper requests from another `Origin` are refused |

Serves `/ui/…` (pages), `/ui/config.json`, `/healthz`, and redirects `/` to `/ui/`.

### In front of it

Route `/ui/` (and `/` if you like) to pulp-nextui and everything else to Pulp, on one host.

Pulp's API answers an anonymous request with `401` and `WWW-Authenticate: Basic`, which makes
browsers open their own password prompt. The UI marks its calls with
`X-Requested-With: XMLHttpRequest`; have the proxy drop `WWW-Authenticate` from those
responses, e.g. a Gateway API rule matching that header on `/pulp/api/v3/` with a
`ResponseHeaderModifier` that removes it, or in nginx:

```nginx
map $http_x_requested_with $pulp_www_authenticate {
    XMLHttpRequest "";
    default        $upstream_http_www_authenticate;
}
server {
    location /pulp/api/v3/ {
        proxy_pass http://pulp;
        proxy_hide_header WWW-Authenticate;
        add_header WWW-Authenticate $pulp_www_authenticate always;
    }
}
```

### Pulp settings for OIDC

With `social-auth-app-django`, roughly:

```python
INSTALLED_APPS = ["social_django", "dynaconf_merge"]
AUTHENTICATION_BACKENDS = [
    "social_core.backends.open_id_connect.OpenIdConnectAuth",
    "django.contrib.auth.backends.ModelBackend",
    "pulpcore.backends.ObjectRolePermissionBackend",
]
SOCIAL_AUTH_OIDC_OIDC_ENDPOINT = "https://sso.example.org/realms/main"
SOCIAL_AUTH_OIDC_KEY = "pulp"
SOCIAL_AUTH_OIDC_SECRET = "…"
SOCIAL_AUTH_LOGIN_REDIRECT_URL = "/ui/"
CSRF_TRUSTED_ORIGINS = ["https://pulp.example.org"]
```

## Building

```sh
docker build -t pulp-nextui .
```

or by hand:

```sh
cd web && npm ci && npm run typecheck && npm run lint && npm run embed && cd ..
go test ./internal/... && go build ./cmd/pulp-nextui
```

| | |
| --- | --- |
| `cmd/pulp-nextui` | the binary: flags, `rotate` |
| `internal/web` | serves the UI; `internal/web/ui` holds the embedded export (not in Git, only its `.gitignore`) |
| `internal/helper` | the helper API and the credentials job |
| `web/` | the Next.js app |

### Developing

`npm run dev` in `web/` serves the UI at http://localhost:3000/ui/ and forwards
`/pulp/api/v3/` and `/ui/config.json` to `PULP_DEV` (default `http://127.0.0.1:8080`): point
it at something that serves both on one origin, e.g. pulp-nextui behind a proxy to a Pulp.

## Rules the code keeps

- No timers and no polling. Lists are fetched when a page opens, after an action, on Refresh
  and when the window regains focus. Changes Pulp runs as tasks show a link to the task.
- A refusal is shown in Pulp's words where the action was started.
- Nothing loaded from another origin and no inline styles in prerendered markup: the server's
  Content-Security-Policy allows neither.

## License

MIT
