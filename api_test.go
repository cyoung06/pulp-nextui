package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakePulp is the slice of Pulp's API the helper uses, with real-enough rules: Basic auth against
// users' passwords, sessions by cookie, admin-only user management, my_permissions per user and
// object, add_role.
type fakePulp struct {
	mu       sync.Mutex
	users    map[string]*fakeUser // by username
	sessions map[string]string    // sessionid -> username
	perms    map[string][]string  // username+" "+href -> permissions
	roles    map[string]bool      // role names
	grants   []string             // "role href user"
	dists    []map[string]any     // python distributions
	nextID   int
}

type fakeUser struct {
	pulpUser
	password string
	admin    bool
}

const repoA = "/pulp/api/v3/repositories/python/python/0190aaaa-0000-7000-8000-000000000001/"
const repoB = "/pulp/api/v3/repositories/python/python/0190bbbb-0000-7000-8000-000000000002/"
const guardA = "/pulp/api/v3/contentguards/core/rbac/0190cccc-0000-7000-8000-000000000003/"

func newFakePulp() *fakePulp {
	f := &fakePulp{users: map[string]*fakeUser{}, sessions: map[string]string{}, perms: map[string][]string{}, roles: map[string]bool{}, nextID: 10}
	f.add("pulp-nextui", "old-password", true)
	f.add("alice", "", false) // owns repo A (OIDC user: no password)
	f.add("bob", "", false)   // owns nothing
	f.add("carol", "", false) // manages every Python repository (model-level role)
	root := f.add("root", "", true)
	_ = root
	f.sessions["s-alice"], f.sessions["s-bob"], f.sessions["s-carol"], f.sessions["s-root"] = "alice", "bob", "carol", "root"
	f.perms["alice "+repoA] = []string{"python.view_pythonrepository", "python.manage_roles_pythonrepository"}
	f.perms["alice "+guardA] = []string{"core.manage_roles_rbaccontentguard"}
	f.perms["bob "+repoA] = []string{"python.view_pythonrepository"}
	f.dists = []map[string]any{{"repository": repoA, "content_guard": guardA}}
	return f
}

func (f *fakePulp) add(name, password string, admin bool) *fakeUser {
	f.nextID++
	u := &fakeUser{pulpUser{Href: fmt.Sprintf("/pulp/api/v3/users/%d/", f.nextID), ID: f.nextID, Username: name, IsActive: true}, password, admin}
	f.users[name] = u
	return u
}

func (f *fakePulp) byHref(href string) *fakeUser {
	for _, u := range f.users {
		if u.Href == href {
			return u
		}
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func (f *fakePulp) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var who *fakeUser
	if name, password, ok := r.BasicAuth(); ok {
		u := f.users[name]
		if u == nil || u.password == "" || u.password != password || !u.IsActive {
			writeJSON(w, 401, map[string]string{"detail": "Invalid username/password."})
			return
		}
		who = u
	} else if c, err := r.Cookie("sessionid"); err == nil {
		who = f.users[f.sessions[c.Value]]
	}
	if who == nil {
		writeJSON(w, 401, map[string]string{"detail": "Authentication credentials were not provided."})
		return
	}
	adminOnly := func() bool {
		if !who.admin {
			writeJSON(w, 403, map[string]string{"detail": "You do not have permission to perform this action."})
		}
		return who.admin
	}
	var body map[string]any
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&body)
	}
	path, q := r.URL.Path, r.URL.Query()
	switch {
	case path == "/pulp/api/v3/login/":
		writeJSON(w, 200, map[string]string{"pulp_href": who.Href, "username": who.Username})
	case strings.HasSuffix(path, "list_roles/"):
		// Pulp's policy: has_model_or_obj_perms:<app>.manage_roles_<model>; superusers pass everything.
		object := strings.TrimSuffix(path, "list_roles/")
		allowed := who.admin || who.Username == "carol" // carol: a model-level role, no object role
		for _, p := range f.perms[who.Username+" "+object] {
			allowed = allowed || strings.Contains(p, ".manage_roles_")
		}
		if !allowed {
			writeJSON(w, 403, map[string]string{"detail": "You do not have permission to perform this action."})
			return
		}
		writeJSON(w, 200, map[string]any{"roles": []any{}})
	case strings.HasSuffix(path, "add_role/"):
		if !adminOnly() {
			return
		}
		for _, u := range body["users"].([]any) {
			f.grants = append(f.grants, fmt.Sprintf("%s %s %s", body["role"], strings.TrimSuffix(path, "add_role/"), u))
		}
		writeJSON(w, 201, map[string]any{})
	case path == "/pulp/api/v3/distributions/python/pypi/":
		var results []map[string]any
		for _, d := range f.dists {
			if d["repository"] == q.Get("repository") {
				results = append(results, d)
			}
		}
		writeJSON(w, 200, map[string]any{"count": len(results), "results": results})
	case path == repoA || path == repoB:
		writeJSON(w, 200, map[string]any{"pulp_href": path, "name": "Team Packages"})
	case path == "/pulp/api/v3/roles/" && r.Method == http.MethodGet:
		var results []map[string]any
		if f.roles[q.Get("name")] {
			results = append(results, map[string]any{"pulp_href": "/pulp/api/v3/roles/x/", "name": q.Get("name"), "permissions": []string{"python.view_pythonrepository", "python.modify_pythonrepository"}})
		}
		writeJSON(w, 200, map[string]any{"count": len(results), "results": results})
	case path == "/pulp/api/v3/roles/" && r.Method == http.MethodPost:
		if adminOnly() {
			f.roles[body["name"].(string)] = true
			writeJSON(w, 201, body)
		}
	case path == "/pulp/api/v3/users/" && r.Method == http.MethodGet:
		if !adminOnly() {
			return
		}
		var results []pulpUser
		for _, u := range f.users {
			if (q.Get("first_name") == "" || u.FirstName == q.Get("first_name")) &&
				(q.Get("username__contains") == "" || strings.Contains(u.Username, q.Get("username__contains"))) &&
				(q.Get("is_active") == "" || u.IsActive == (q.Get("is_active") == "true")) {
				results = append(results, u.pulpUser)
			}
		}
		writeJSON(w, 200, map[string]any{"count": len(results), "results": results})
	case path == "/pulp/api/v3/users/" && r.Method == http.MethodPost:
		if !adminOnly() {
			return
		}
		name := body["username"].(string)
		if f.users[name] != nil {
			writeJSON(w, 400, map[string]any{"username": []string{"A user with that username already exists."}})
			return
		}
		u := f.add(name, body["password"].(string), false)
		u.FirstName, u.LastName = body["first_name"].(string), body["last_name"].(string)
		writeJSON(w, 201, u.pulpUser)
	case strings.HasPrefix(path, "/pulp/api/v3/users/"):
		u := f.byHref(path)
		if u == nil {
			writeJSON(w, 404, map[string]string{"detail": "Not found."})
			return
		}
		if u != who && !adminOnly() {
			return
		}
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, 200, u.pulpUser)
		case http.MethodPatch:
			if v, ok := body["password"].(string); ok {
				u.password = v
			}
			if v, ok := body["is_active"].(bool); ok {
				u.IsActive = v
			}
			if v, ok := body["last_name"].(string); ok {
				u.LastName = v
			}
			writeJSON(w, 200, u.pulpUser)
		case http.MethodDelete:
			delete(f.users, u.Username)
			w.WriteHeader(204)
		}
	default:
		writeJSON(w, 404, map[string]string{"detail": "Not found."})
	}
}

// fakeKube serves one Secret with resourceVersion checks.
type fakeKube struct {
	mu      sync.Mutex
	data    map[string][]byte
	version int
	fail    func(method string) bool // fail this call (to simulate a crash between steps)
}

func (k *fakeKube) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.fail != nil && k.fail(r.Method) {
		http.Error(w, "boom", 500)
		return
	}
	obj := func() secretObject {
		return secretObject{APIVersion: "v1", Kind: "Secret", Metadata: map[string]any{"name": "creds", "resourceVersion": fmt.Sprint(k.version)}, Data: k.data}
	}
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, 200, obj())
	case http.MethodPut:
		var s secretObject
		json.NewDecoder(r.Body).Decode(&s)
		if s.Metadata["resourceVersion"] != fmt.Sprint(k.version) {
			http.Error(w, "conflict", 409)
			return
		}
		k.data, k.version = s.Data, k.version+1
		writeJSON(w, 200, obj())
	}
}

type harness struct {
	pulp    *fakePulp
	kube    *fakeKube
	handler http.Handler
	client  *pulpClient
	k       *kube
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	fp := newFakePulp()
	fk := &fakeKube{data: map[string][]byte{"username": []byte("pulp-nextui"), "password": []byte("old-password")}}
	ps, ks := httptest.NewServer(fp), httptest.NewServer(fk)
	t.Cleanup(ps.Close)
	t.Cleanup(ks.Close)
	k := &kube{base: ks.URL, token: "t", client: ks.Client()}
	client := newPulpClient(ps.URL, k, secretRef{"pulp", "creds"})
	a := &api{pulp: client, origin: "https://pulp.example.org", log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	h, err := Handler(UI(), Config{LoginURL: "/x"}, a)
	if err != nil {
		t.Fatal(err)
	}
	return &harness{fp, fk, h, client, k}
}

func (h *harness) call(t *testing.T, method, path, session string, body any, headers map[string]string) (int, map[string]any) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = strings.NewReader(string(b))
	}
	r := httptest.NewRequest(method, path, reader)
	r.Header.Set("X-Requested-With", "XMLHttpRequest")
	r.Header.Set("Origin", "https://pulp.example.org")
	for k, v := range headers {
		if v == "" {
			r.Header.Del(k)
		} else {
			r.Header.Set(k, v)
		}
	}
	if session != "" {
		r.AddCookie(&http.Cookie{Name: "sessionid", Value: session})
	}
	w := httptest.NewRecorder()
	h.handler.ServeHTTP(w, r)
	var out map[string]any
	json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestRequestsFromOtherSitesAreRefused(t *testing.T) {
	h := newHarness(t)
	for name, headers := range map[string]map[string]string{
		"no X-Requested-With": {"X-Requested-With": ""},
		"other origin":        {"Origin": "https://evil.example"},
		"cross-site fetch":    {"Sec-Fetch-Site": "cross-site"},
	} {
		if code, _ := h.call(t, "POST", "/ui/api/cli-secret", "s-alice", nil, headers); code != 403 {
			t.Errorf("%s: %d, want 403", name, code)
		}
	}
	if h.pulp.users["alice"].password != "" {
		t.Error("a refused request changed alice's password")
	}
}

func TestCLISecretIsTheCallersOwn(t *testing.T) {
	h := newHarness(t)
	if code, _ := h.call(t, "POST", "/ui/api/cli-secret", "", nil, nil); code != 401 {
		t.Errorf("without a session: %d, want 401", code)
	}
	if code, _ := h.call(t, "POST", "/ui/api/cli-secret", "s-nobody", nil, nil); code != 401 {
		t.Errorf("unknown session: %d, want 401", code)
	}
	code, out := h.call(t, "POST", "/ui/api/cli-secret", "s-alice", nil, nil)
	if code != 200 || out["username"] != "alice" || out["secret"] == "" || h.pulp.users["alice"].password != out["secret"] {
		t.Fatalf("alice: %d %v", code, out)
	}
	if h.pulp.users["bob"].password != "" || h.pulp.users["pulp-nextui"].password != "old-password" {
		t.Error("someone else's password changed")
	}
}

func TestRobotNeedsRepositoryOwner(t *testing.T) {
	h := newHarness(t)
	body := map[string]any{"repository": repoA, "name": "ci", "push": true}
	if code, _ := h.call(t, "POST", "/ui/api/robots", "s-bob", body, nil); code != 403 {
		t.Errorf("bob (viewer): %d, want 403", code)
	}
	if code, _ := h.call(t, "POST", "/ui/api/robots", "s-alice", map[string]any{"repository": repoB, "name": "ci", "push": true}, nil); code != 403 {
		t.Errorf("alice on a repository she doesn't own: %d, want 403", code)
	}
	if code, _ := h.call(t, "POST", "/ui/api/robots", "s-alice", map[string]any{"repository": "/pulp/api/v3/users/1/", "name": "ci", "push": true}, nil); code != 400 {
		t.Errorf("not a repository: %d, want 400", code)
	}
	for name := range h.pulp.users {
		if strings.HasPrefix(name, robotPrefix) {
			t.Errorf("a refused request created %s", name)
		}
	}
}

func TestRobotForModelLevelManagersAndSuperusers(t *testing.T) {
	h := newHarness(t)
	for _, session := range []string{"s-carol", "s-root"} {
		code, out := h.call(t, "POST", "/ui/api/robots", session, map[string]any{"repository": repoB, "name": strings.TrimPrefix(session, "s-"), "push": true}, nil)
		if code != 200 {
			t.Errorf("%s: %d %v", session, code, out)
		}
	}
}

func TestRobotLifecycle(t *testing.T) {
	h := newHarness(t)
	expiry := time.Now().UTC().AddDate(0, 1, 0).Format("2006-01-02")
	code, out := h.call(t, "POST", "/ui/api/robots", "s-alice", map[string]any{"repository": repoA, "name": "ci", "push": true, "pull": true, "expires": expiry}, nil)
	if code != 200 {
		t.Fatalf("create: %d %v", code, out)
	}
	rb := out["robot"].(map[string]any)
	name := rb["username"].(string)
	u := h.pulp.users[name]
	if name != "robot+team-packages+ci" || u == nil || u.password != out["secret"] || u.FirstName != repoA || u.LastName != expiry || u.admin {
		t.Fatalf("robot %q: %+v", name, u)
	}
	want := []string{"nextui.python.pusher " + repoA + " " + name, downloaderRole + " " + guardA + " " + name}
	if strings.Join(h.pulp.grants, "|") != strings.Join(want, "|") {
		t.Errorf("grants %v, want %v", h.pulp.grants, want)
	}
	if !h.pulp.roles["nextui.python.pusher"] {
		t.Error("push role not created")
	}
	id := fmt.Sprint(int(rb["id"].(float64)))

	if code, _ := h.call(t, "GET", "/ui/api/robots?repository="+repoA, "s-bob", nil, nil); code != 403 {
		t.Errorf("bob listing alice's robots: %d, want 403", code)
	}
	if code, _ := h.call(t, "POST", "/ui/api/robots/"+id+"/secret", "s-bob", nil, nil); code != 403 {
		t.Errorf("bob regenerating alice's robot: %d, want 403", code)
	}
	old := u.password
	if code, out := h.call(t, "POST", "/ui/api/robots/"+id+"/secret", "s-alice", nil, nil); code != 200 || u.password == old || u.password != out["secret"] {
		t.Errorf("regenerate: %d", code)
	}
	if code, _ := h.call(t, "PATCH", "/ui/api/robots/"+id, "s-alice", map[string]any{"active": false}, nil); code != 200 || u.IsActive {
		t.Errorf("disable: %d active=%v", code, u.IsActive)
	}
	// Ids of users that are not robots are not robots.
	if code, _ := h.call(t, "DELETE", "/ui/api/robots/"+fmt.Sprint(h.pulp.users["bob"].ID), "s-alice", nil, nil); code != 404 || h.pulp.users["bob"] == nil {
		t.Errorf("deleting bob through the robot API: %d", code)
	}
	if code, _ := h.call(t, "DELETE", "/ui/api/robots/"+id, "s-alice", nil, nil); code != 200 || h.pulp.users[name] != nil {
		t.Errorf("delete: %d", code)
	}
}

func TestExpiredRobotsAreDisabled(t *testing.T) {
	h := newHarness(t)
	yesterday, tomorrow := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02"), time.Now().UTC().AddDate(0, 0, 1).Format("2006-01-02")
	old := h.pulp.add("robot+team+old", "x", false)
	old.FirstName, old.LastName = repoA, yesterday
	fresh := h.pulp.add("robot+team+fresh", "x", false)
	fresh.FirstName, fresh.LastName = repoA, tomorrow
	forever := h.pulp.add("robot+team+forever", "x", false)
	forever.FirstName = repoA
	if err := maintain(context.Background(), &api{pulp: h.client, log: slog.New(slog.NewTextHandler(io.Discard, nil))}, time.Now()); err != nil {
		t.Fatal(err)
	}
	if old.IsActive || !fresh.IsActive || !forever.IsActive {
		t.Errorf("old=%v fresh=%v forever=%v, want false true true", old.IsActive, fresh.IsActive, forever.IsActive)
	}
	if !h.pulp.roles["nextui.npm.pusher"] || !h.pulp.roles["nextui.maven.pusher"] {
		t.Error("robot roles not ensured")
	}
}

// setPassword is step 2 of the Job (Pulp's own image): the account exists and has the file's password.
func (h *harness) setPassword(t *testing.T, dir string) {
	t.Helper()
	pw, err := os.ReadFile(dir + "/password")
	if err != nil {
		t.Fatal(err)
	}
	h.pulp.mu.Lock()
	defer h.pulp.mu.Unlock()
	if u := h.pulp.users["pulp-nextui"]; u != nil {
		u.password = string(pw)
	} else {
		h.pulp.add("pulp-nextui", string(pw), true)
	}
}

func runJob(t *testing.T, h *harness, failKube int) error {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	ref := secretRef{"pulp", "creds"}
	calls := 0
	h.kube.fail = func(string) bool { calls++; return calls == failKube }
	defer func() { h.kube.fail = nil }()
	dir := t.TempDir()
	if err := prepare(context.Background(), h.k, ref, dir, log); err != nil {
		return err
	}
	h.setPassword(t, dir)
	return finish(context.Background(), h.k, h.client, ref, log)
}

func TestRotationResumesAfterAnyCrash(t *testing.T) {
	// prepare: GET, PUT, GET; finish: GET, PUT. Crash at each, then run the whole Job again.
	for crash := 1; crash <= 5; crash++ {
		h := newHarness(t)
		if err := runJob(t, h, crash); err == nil {
			t.Errorf("crash %d: first run succeeded", crash)
		}
		if err := runJob(t, h, 0); err != nil {
			t.Fatalf("crash %d: second run: %v", crash, err)
		}
		pw := string(h.kube.data["password"])
		if _, next := h.kube.data["next"]; next || pw == "old-password" || h.pulp.users["pulp-nextui"].password != pw {
			t.Errorf("crash %d: secret %q (next %v), pulp %q", crash, pw, next, h.pulp.users["pulp-nextui"].password)
		}
	}
}

func TestBootstrapFromAnEmptySecret(t *testing.T) {
	h := newHarness(t)
	delete(h.pulp.users, "pulp-nextui")
	h.kube.data = map[string][]byte{} // as declared in Git: no username, no password
	if err := runJob(t, h, 0); err != nil {
		t.Fatal(err)
	}
	if string(h.kube.data["username"]) != "pulp-nextui" || h.pulp.users["pulp-nextui"] == nil ||
		h.pulp.users["pulp-nextui"].password != string(h.kube.data["password"]) {
		t.Fatalf("after bootstrap: secret %v", h.kube.data)
	}
	if code, _ := h.call(t, "POST", "/ui/api/cli-secret", "s-alice", nil, nil); code != 200 {
		t.Errorf("helper after bootstrap: %d", code)
	}
}

func TestHelperFollowsARotation(t *testing.T) {
	h := newHarness(t)
	// The helper has the old password cached; Pulp moves to "next" while the Secret still says
	// password=old, next=new (between rotation steps 2 and 3).
	if code, _ := h.call(t, "POST", "/ui/api/cli-secret", "s-alice", nil, nil); code != 200 {
		t.Fatal("warm-up failed")
	}
	h.kube.data["next"] = []byte("new-password")
	h.pulp.users["pulp-nextui"].password = "new-password"
	if code, out := h.call(t, "POST", "/ui/api/cli-secret", "s-alice", nil, nil); code != 200 {
		t.Fatalf("after Pulp's password changed: %d %v", code, out)
	}
}
