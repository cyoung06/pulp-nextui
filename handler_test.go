package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func testHandler(t *testing.T) http.Handler {
	t.Helper()
	files := fstest.MapFS{
		"index.html":               {Data: []byte(`<html><script>self.a=1</script><script src="/ui/_next/x.js"></script></html>`)},
		"tasks/index.html":         {Data: []byte(`<html>tasks</html>`)},
		"404.html":                 {Data: []byte(`<html>missing</html>`)},
		"_next/static/chunks/a.js": {Data: []byte(`console.log(1)`)},
		".hidden":                  {Data: []byte(`secret`)},
	}
	h, err := Handler(files, Config{Title: "Pulp", APIBase: "/pulp/api/v3/", LoginURL: "/login/oidc/"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func get(t *testing.T, h http.Handler, target string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, target, nil))
	return w
}

func TestPages(t *testing.T) {
	h := testHandler(t)
	for _, c := range []struct {
		target, body string
		status       int
	}{
		{"/ui/", "self.a=1", 200},
		{"/ui/tasks/", "tasks", 200},
		{"/ui/nope/", "missing", 404},
		{"/ui/.hidden", "missing", 404},
		{"/ui/_next/static/chunks/a.js", "console.log", 200},
	} {
		w := get(t, h, c.target)
		if w.Code != c.status || !strings.Contains(w.Body.String(), c.body) {
			t.Errorf("%s: %d %q, want %d containing %q", c.target, w.Code, w.Body.String(), c.status, c.body)
		}
	}
}

func TestRedirects(t *testing.T) {
	h := testHandler(t)
	for target, location := range map[string]string{"/": "/ui/", "/ui": "/ui/", "/ui/tasks": "/ui/tasks/"} {
		w := get(t, h, target)
		if w.Code/100 != 3 || w.Header().Get("Location") != location {
			t.Errorf("%s: %d to %q, want a redirect to %q", target, w.Code, w.Header().Get("Location"), location)
		}
	}
}

func TestPolicy(t *testing.T) {
	h := testHandler(t)
	page := get(t, h, "/ui/").Header().Get("Content-Security-Policy")
	if !strings.Contains(page, "script-src 'self' 'sha256-") || strings.Count(page, "'sha256-") != 1 {
		t.Errorf("page policy %q: want 'self' and one hash (the inline script only)", page)
	}
	if p := get(t, h, "/ui/config.json").Header().Get("Content-Security-Policy"); strings.Contains(p, "script-src") {
		t.Errorf("config policy %q allows scripts", p)
	}
}

func TestConfig(t *testing.T) {
	w := get(t, testHandler(t), "/ui/config.json")
	var cfg Config
	if err := json.Unmarshal(w.Body.Bytes(), &cfg); err != nil || cfg.LoginURL != "/login/oidc/" || cfg.APIBase != "/pulp/api/v3/" {
		t.Errorf("config %s (%v)", w.Body.String(), err)
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("config is cacheable")
	}
}
