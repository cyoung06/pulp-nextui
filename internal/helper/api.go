// Package helper is pulp-nextui's helper API (/ui/api/) and the job that creates and rotates the Pulp
// account it acts as.
package helper

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// The helper API under /ui/api/: what Pulp lets only admins do, done for a signed-in user within
// narrow rules. Pulp authenticates every caller: the browser's session cookie goes to Pulp's own
// GET login/, and Pulp is asked with that same cookie whether it may manage roles on the object
// (GET list_roles/, which Pulp allows exactly then). Only
// then does pulp-nextui act, as its admin account, and only in these ways:
//
//	POST   /ui/api/cli-secret          a new password for the caller's own user (pip, npm, mvn)
//	GET    /ui/api/robots?repository=  the robot accounts of a repository
//	POST   /ui/api/robots              a robot for a repository (pull and/or push on it only)
//	POST   /ui/api/robots/{id}/secret  a new secret for a robot
//	PATCH  /ui/api/robots/{id}         enable/disable, change the expiry
//	DELETE /ui/api/robots/{id}
//
// Robots and secrets need the caller to be able to manage roles on the repository. Requests must
// carry X-Requested-With: XMLHttpRequest, which a cross-origin page can't send without a CORS
// preflight this server never answers, and a same-origin Origin when they have one.

// API is the helper: what Pulp lets only admins do, done for signed-in users within narrow rules.
type API struct {
	pulp   *pulpClient
	origin string // the public origin, e.g. https://pulp.example.org; empty: Origin isn't checked
	log    *slog.Logger
}

// Robots: user "robot+<repository slug>+<name>", first_name = the repository's href, last_name = the
// expiry date (YYYY-MM-DD, UTC; empty: none). Pulp users have no other place for either.
const robotPrefix = "robot+"

var (
	repositoryHref = regexp.MustCompile(`^/pulp/api/v3/repositories/(python/python|npm/npm|maven/maven)/[0-9a-f-]{36}/$`)
	robotName      = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)
	slugRun        = regexp.MustCompile(`[^a-z0-9._-]+`)
	userID         = regexp.MustCompile(`^[0-9]{1,12}$`)
)

// Per repository type: the permission that makes the caller an owner (may manage roles on it) and
// the minimal role a pushing robot gets (view + modify; the built-in owner role would also let it
// delete the repository and hand out roles).
type repositoryType struct {
	managePermission string
	pushRole         string
	pushPermissions  []string
}

var repositoryTypes = map[string]repositoryType{
	"python/python": {"python.manage_roles_pythonrepository", "nextui.python.pusher", []string{"python.view_pythonrepository", "python.modify_pythonrepository"}},
	"npm/npm":       {"npm.manage_roles_npmrepository", "nextui.npm.pusher", []string{"npm.view_npmrepository", "npm.modify_npmrepository"}},
	"maven/maven":   {"maven.manage_roles_mavenrepository", "nextui.maven.pusher", []string{"maven.view_mavenrepository", "maven.modify_mavenrepository"}},
}

const downloaderRole = "core.rbaccontentguard_downloader"

func typeOf(href string) (repositoryType, bool) {
	m := repositoryHref.FindStringSubmatch(href)
	if m == nil {
		return repositoryType{}, false
	}
	t, ok := repositoryTypes[m[1]]
	return t, ok
}

// httpError is a refusal of this API, sent as {"detail": message}.
type httpError struct {
	status  int
	message string
}

func (e *httpError) Error() string { return e.message }

func refuse(status int, format string, args ...any) error {
	return &httpError{status, fmt.Sprintf(format, args...)}
}

// New is the helper for Pulp's API at pulpURL (inside the cluster), acting as the account in the
// Secret "namespace/name"; requests whose Origin isn't origin are refused.
func New(pulpURL, secret, origin string, log *slog.Logger) (*API, error) {
	ref, err := parseSecretRef(secret)
	if err != nil {
		return nil, err
	}
	k, err := inCluster()
	if err != nil {
		return nil, err
	}
	return &API{pulp: newPulpClient(pulpURL, k, ref), origin: strings.TrimRight(origin, "/"), log: log}, nil
}

// Routes adds the helper's endpoints to mux.
func (a *API) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /ui/api/cli-secret", a.handle(a.cliSecret))
	mux.HandleFunc("GET /ui/api/robots", a.handle(a.listRobots))
	mux.HandleFunc("POST /ui/api/robots", a.handle(a.createRobot))
	mux.HandleFunc("POST /ui/api/robots/{id}/secret", a.handle(a.robotSecret))
	mux.HandleFunc("PATCH /ui/api/robots/{id}", a.handle(a.changeRobot))
	mux.HandleFunc("DELETE /ui/api/robots/{id}", a.handle(a.deleteRobot))
}

func (a *API) handle(h func(*http.Request) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		result, err := a.guard(r, h)
		if err != nil {
			status, message := http.StatusBadGateway, "Pulp could not be reached or refused pulp-nextui."
			var he *httpError
			var pe *pulpError
			switch {
			case errors.As(err, &he):
				status, message = he.status, he.message
			case errors.As(err, &pe) && pe.Status < 500:
				w.WriteHeader(pe.Status)
				w.Write(pe.Body) // Pulp's own words
				return
			default:
				a.log.Error("api", "path", r.URL.Path, "err", err)
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(map[string]string{"detail": message})
			return
		}
		json.NewEncoder(w).Encode(result)
	}
}

func (a *API) guard(r *http.Request, h func(*http.Request) (any, error)) (any, error) {
	if r.Header.Get("X-Requested-With") != "XMLHttpRequest" {
		return nil, refuse(http.StatusForbidden, "Missing X-Requested-With.")
	}
	if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" {
		return nil, refuse(http.StatusForbidden, "Cross-site request refused.")
	}
	if origin := r.Header.Get("Origin"); origin != "" && a.origin != "" && origin != a.origin {
		return nil, refuse(http.StatusForbidden, "Cross-origin request refused.")
	}
	return h(r)
}

type login struct {
	Href     string `json:"pulp_href"`
	Username string `json:"username"`
}

// caller is who Pulp says the browser is.
func (a *API) caller(r *http.Request) (login, error) {
	var me login
	if err := a.pulp.asUser(r.Context(), r, http.MethodGet, "/pulp/api/v3/login/", &me); err != nil {
		return login{}, err
	}
	if strings.HasPrefix(me.Username, robotPrefix) {
		return login{}, refuse(http.StatusForbidden, "Robot accounts can't use this.")
	}
	return me, nil
}

// canManageRoles asks Pulp whether the caller may manage roles on an object, by making the request
// that needs exactly that as the caller: GET {href}list_roles/ (policy:
// has_model_or_obj_perms:<app>.manage_roles_<model>). Pulp answers with all its rules: superusers,
// model-level and group roles, object roles. (my_permissions lists only object roles.)
func (a *API) canManageRoles(r *http.Request, href string) (bool, error) {
	err := a.pulp.asUser(r.Context(), r, http.MethodGet, href+"list_roles/", nil)
	if isStatus(err, http.StatusForbidden) || isStatus(err, http.StatusNotFound) {
		return false, nil
	}
	return err == nil, err
}

// requireManage refuses unless Pulp says the caller may manage roles on the repository.
func (a *API) requireManage(r *http.Request, href string) (repositoryType, error) {
	t, ok := typeOf(href)
	if !ok {
		return t, refuse(http.StatusBadRequest, "Not a Python, npm or Maven repository: %q.", href)
	}
	allowed, err := a.canManageRoles(r, href)
	if err != nil {
		return t, err
	}
	if !allowed {
		return t, refuse(http.StatusForbidden, "You can't manage access to this repository (%s).", t.managePermission)
	}
	return t, nil
}

func (a *API) cliSecret(r *http.Request) (any, error) {
	me, err := a.caller(r)
	if err != nil {
		return nil, err
	}
	secret := newSecret()
	if err := a.pulp.admin(r.Context(), http.MethodPatch, me.Href, map[string]string{"password": secret}, nil); err != nil {
		return nil, err
	}
	a.log.Info("cli secret set", "user", me.Username)
	return map[string]string{"username": me.Username, "secret": secret}, nil
}

type robot struct {
	ID         int    `json:"id"`
	Username   string `json:"username"`
	Name       string `json:"name"`
	Repository string `json:"repository"`
	Active     bool   `json:"active"`
	Expires    string `json:"expires,omitempty"`
	Created    string `json:"created"`
}

func robotOf(u pulpUser) (robot, bool) {
	if !strings.HasPrefix(u.Username, robotPrefix) || !repositoryHref.MatchString(u.FirstName) {
		return robot{}, false
	}
	name := u.Username[strings.LastIndex(u.Username, "+")+1:]
	return robot{u.ID, u.Username, name, u.FirstName, u.IsActive, u.LastName, u.DateJoined}, true
}

func (a *API) listRobots(r *http.Request) (any, error) {
	if _, err := a.caller(r); err != nil {
		return nil, err
	}
	href := r.URL.Query().Get("repository")
	if _, err := a.requireManage(r, href); err != nil {
		return nil, err
	}
	users, err := allPages[pulpUser](r.Context(), a.pulp, "/pulp/api/v3/users/"+query(map[string]string{"first_name": href, "limit": "200"}))
	if err != nil {
		return nil, err
	}
	robots := []robot{}
	for _, u := range users {
		if rb, ok := robotOf(u); ok && rb.Repository == href {
			robots = append(robots, rb)
		}
	}
	return robots, nil
}

func validExpiry(v string) error {
	if v == "" {
		return nil
	}
	day, err := time.Parse("2006-01-02", v)
	if err != nil {
		return refuse(http.StatusBadRequest, "Expiry %q: use YYYY-MM-DD.", v)
	}
	if !day.After(time.Now().UTC().Truncate(24 * time.Hour)) {
		return refuse(http.StatusBadRequest, "Expiry %s is not in the future.", v)
	}
	return nil
}

func decodeBody(r *http.Request, out any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 64<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		return refuse(http.StatusBadRequest, "Bad request body: %v.", err)
	}
	return nil
}

func (a *API) createRobot(r *http.Request) (any, error) {
	me, err := a.caller(r)
	if err != nil {
		return nil, err
	}
	var in struct {
		Repository string `json:"repository"`
		Name       string `json:"name"`
		Expires    string `json:"expires"`
		Pull       bool   `json:"pull"`
		Push       bool   `json:"push"`
	}
	if err := decodeBody(r, &in); err != nil {
		return nil, err
	}
	if !robotName.MatchString(in.Name) {
		return nil, refuse(http.StatusBadRequest, "Name: 1-32 lowercase letters, digits and -, starting with a letter or digit.")
	}
	if !in.Pull && !in.Push {
		return nil, refuse(http.StatusBadRequest, "Choose pull, push or both.")
	}
	if err := validExpiry(in.Expires); err != nil {
		return nil, err
	}
	t, err := a.requireManage(r, in.Repository)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	var repo struct {
		Name string `json:"name"`
	}
	if err := a.pulp.admin(ctx, http.MethodGet, in.Repository, nil, &repo); err != nil {
		return nil, err
	}
	// Downloads are checked by the content guards of the distributions serving the repository; the
	// caller must be able to manage roles on each private one.
	var guards []string
	if in.Pull {
		if guards, err = a.privateGuards(r, in.Repository); err != nil {
			return nil, err
		}
	}
	if in.Push {
		if err := a.ensureRole(ctx, t.pushRole, t.pushPermissions); err != nil {
			return nil, err
		}
	}
	slug := strings.Trim(slugRun.ReplaceAllString(strings.ToLower(repo.Name), "-"), "-.")
	if len(slug) > 64 {
		slug = slug[:64]
	}
	secret := newSecret()
	var user pulpUser
	if err := a.pulp.admin(ctx, http.MethodPost, "/pulp/api/v3/users/", map[string]any{
		"username": robotPrefix + slug + "+" + in.Name, "password": secret,
		"first_name": in.Repository, "last_name": in.Expires, "is_active": true, "is_staff": false,
	}, &user); err != nil {
		return nil, err
	}
	grant := func(href, role string) error {
		return a.pulp.admin(ctx, http.MethodPost, href+"add_role/", map[string]any{"role": role, "users": []string{user.Username}}, nil)
	}
	var grantErr error
	if in.Push {
		grantErr = grant(in.Repository, t.pushRole)
	}
	for _, g := range guards {
		if grantErr == nil {
			grantErr = grant(g, downloaderRole)
		}
	}
	if grantErr != nil {
		// A robot without its roles is no use: take it back out.
		if err := a.pulp.admin(context.WithoutCancel(ctx), http.MethodDelete, user.Href, nil, nil); err != nil {
			a.log.Error("robot cleanup", "user", user.Username, "err", err)
		}
		return nil, grantErr
	}
	a.log.Info("robot created", "robot", user.Username, "by", me.Username, "pull", in.Pull, "push", in.Push)
	rb, _ := robotOf(user)
	return map[string]any{"robot": rb, "secret": secret, "privateDistributions": len(guards)}, nil
}

// privateGuards are the RBAC content guards of the distributions serving a repository, after checking
// the caller may manage roles on each.
func (a *API) privateGuards(r *http.Request, href string) ([]string, error) {
	m := repositoryHref.FindStringSubmatch(href)
	distributions := map[string]string{"python/python": "python/pypi", "npm/npm": "npm/npm", "maven/maven": "maven/maven"}[m[1]]
	dists, err := allPages[struct {
		Guard *string `json:"content_guard"`
	}](r.Context(), a.pulp, "/pulp/api/v3/distributions/"+distributions+"/"+query(map[string]string{"repository": href, "limit": "200"}))
	if err != nil {
		return nil, err
	}
	var guards []string
	for _, d := range dists {
		if d.Guard == nil || !strings.Contains(*d.Guard, "/contentguards/core/rbac/") {
			continue
		}
		allowed, err := a.canManageRoles(r, *d.Guard)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, refuse(http.StatusForbidden, "You can't manage who may download from %s.", *d.Guard)
		}
		guards = append(guards, *d.Guard)
	}
	return guards, nil
}

// ensureRole creates or corrects one of pulp-nextui's own minimal roles. Idempotent.
func (a *API) ensureRole(ctx context.Context, name string, permissions []string) error {
	roles, err := allPages[pulpRole](ctx, a.pulp, "/pulp/api/v3/roles/"+query(map[string]string{"name": name}))
	if err != nil {
		return err
	}
	body := map[string]any{"name": name, "description": "pulp-nextui robots: " + strings.Join(permissions, ", "), "permissions": permissions}
	if len(roles) == 0 {
		err := a.pulp.admin(ctx, http.MethodPost, "/pulp/api/v3/roles/", body, nil)
		if isStatus(err, http.StatusBadRequest) { // created meanwhile by another request
			return nil
		}
		return err
	}
	if strings.Join(roles[0].Permissions, ",") != strings.Join(permissions, ",") {
		return a.pulp.admin(ctx, http.MethodPatch, roles[0].Href, body, nil)
	}
	return nil
}

// robotFor loads robot {id} and checks the caller may manage its repository.
func (a *API) robotFor(r *http.Request) (pulpUser, robot, error) {
	if _, err := a.caller(r); err != nil {
		return pulpUser{}, robot{}, err
	}
	id := r.PathValue("id")
	if !userID.MatchString(id) {
		return pulpUser{}, robot{}, refuse(http.StatusNotFound, "No such robot.")
	}
	var u pulpUser
	if err := a.pulp.admin(r.Context(), http.MethodGet, "/pulp/api/v3/users/"+id+"/", nil, &u); err != nil {
		if isStatus(err, http.StatusNotFound) {
			return pulpUser{}, robot{}, refuse(http.StatusNotFound, "No such robot.")
		}
		return pulpUser{}, robot{}, err
	}
	rb, ok := robotOf(u)
	if !ok {
		return pulpUser{}, robot{}, refuse(http.StatusNotFound, "No such robot.")
	}
	if _, err := a.requireManage(r, rb.Repository); err != nil {
		return pulpUser{}, robot{}, err
	}
	return u, rb, nil
}

func (a *API) robotSecret(r *http.Request) (any, error) {
	u, rb, err := a.robotFor(r)
	if err != nil {
		return nil, err
	}
	secret := newSecret()
	if err := a.pulp.admin(r.Context(), http.MethodPatch, u.Href, map[string]string{"password": secret}, nil); err != nil {
		return nil, err
	}
	a.log.Info("robot secret regenerated", "robot", rb.Username)
	return map[string]any{"robot": rb, "secret": secret}, nil
}

func (a *API) changeRobot(r *http.Request) (any, error) {
	u, rb, err := a.robotFor(r)
	if err != nil {
		return nil, err
	}
	var in struct {
		Active  *bool   `json:"active"`
		Expires *string `json:"expires"`
	}
	if err := decodeBody(r, &in); err != nil {
		return nil, err
	}
	change := map[string]any{}
	if in.Active != nil {
		change["is_active"] = *in.Active
		rb.Active = *in.Active
	}
	if in.Expires != nil {
		if err := validExpiry(*in.Expires); err != nil {
			return nil, err
		}
		change["last_name"] = *in.Expires
		rb.Expires = *in.Expires
	}
	if len(change) == 0 {
		return rb, nil
	}
	if err := a.pulp.admin(r.Context(), http.MethodPatch, u.Href, change, nil); err != nil {
		return nil, err
	}
	return rb, nil
}

func (a *API) deleteRobot(r *http.Request) (any, error) {
	u, rb, err := a.robotFor(r)
	if err != nil {
		return nil, err
	}
	if err := a.pulp.admin(r.Context(), http.MethodDelete, u.Href, nil, nil); err != nil {
		return nil, err
	}
	a.log.Info("robot deleted", "robot", rb.Username)
	return map[string]string{}, nil
}
