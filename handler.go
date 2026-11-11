package main

import (
	"crypto/sha256"
	"embed"
	"encoding/base64"
	"encoding/json"
	"io/fs"
	"net/http"
	"path"
	"regexp"
	"strings"
)

// The export (web/out) is copied into ui/ before the binary is built (see ui/.gitignore and
// web/scripts/embed.mjs). A build without it serves no pages.
//
//go:embed all:ui
var embedded embed.FS

// UI is the embedded export.
func UI() fs.FS {
	files, _ := fs.Sub(embedded, "ui")
	return files
}

// Config is /ui/config.json: what the UI is told about its deployment.
type Config struct {
	Title         string `json:"title"`
	APIBase       string `json:"apiBase"`
	LoginURL      string `json:"loginUrl"`
	LoginProvider string `json:"loginProvider"`
	// Plugins limits which content types the UI shows (python, npm, maven, container); empty shows
	// every one Pulp reports.
	Plugins []string `json:"plugins,omitempty"`
	// Helper says the helper API (/ui/api/) is on: CLI secrets and robot accounts.
	Helper bool `json:"helper"`
}

// basePolicy is the Content-Security-Policy of every response: everything from this origin only.
// The UI talks to nothing but Pulp, which is this origin. Styles need no exception (the export
// has no inline styles); a page's own inline scripts are allowed by hash (pagePolicy).
const basePolicy = "default-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"

var inlineScript = regexp.MustCompile(`(?s)<script(\s[^>]*)?>(.*?)</script>`)

// pagePolicy adds the script-src that lets a page run its own inline scripts and nothing else
// inline: 'self' plus the sha256 of each one.
func pagePolicy(page []byte) string {
	p := basePolicy + "; script-src 'self'"
	for _, m := range inlineScript.FindAllSubmatch(page, -1) {
		if len(m[2]) > 0 {
			sum := sha256.Sum256(m[2])
			p += " 'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
		}
	}
	return p
}

// Handler serves the UI under /ui/, its /ui/config.json, /healthz, and a redirect from / to
// /ui/. A page is served at its directory (/ui/tasks/ is tasks/index.html); anything that is not
// a file of the export is the export's 404 page.
func Handler(files fs.FS, cfg Config, helper *api) (http.Handler, error) {
	policies := map[string]string{} // .html file -> its Content-Security-Policy
	err := fs.WalkDir(files, ".", func(name string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(name, ".html") {
			return err
		}
		page, err := fs.ReadFile(files, name)
		policies[name] = pagePolicy(page)
		return err
	})
	if err != nil {
		return nil, err
	}
	config, err := json.Marshal(cfg)
	if err != nil {
		return nil, err
	}

	notFound := func(w http.ResponseWriter) {
		page, err := fs.ReadFile(files, "404.html")
		if err != nil {
			http.Error(w, "404 page not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Security-Policy", policies["404.html"])
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		w.Write(page)
	}

	mux := http.NewServeMux()
	if helper != nil {
		helper.routes(mux)
	}
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ui/", http.StatusFound)
	})
	mux.HandleFunc("GET /ui", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ui/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("GET /ui/config.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(config)
	})
	mux.HandleFunc("GET /ui/", func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/ui")
		name = strings.TrimPrefix(name, "/")
		if name == "" || strings.HasSuffix(r.URL.Path, "/") {
			name = path.Join(name, "index.html")
		}
		if strings.HasPrefix(name, ".") || strings.Contains(name, "/.") {
			notFound(w)
			return
		}
		info, err := fs.Stat(files, name)
		if err == nil && info.IsDir() {
			// A page without its trailing slash: send the browser to the canonical address.
			http.Redirect(w, r, r.URL.Path+"/", http.StatusMovedPermanently)
			return
		}
		if err != nil {
			notFound(w)
			return
		}
		if p, page := policies[name]; page {
			w.Header().Set("Content-Security-Policy", p)
			w.Header().Set("Cache-Control", "no-cache")
		} else if strings.HasPrefix(name, "_next/static/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		http.ServeFileFS(w, r, files, name)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", basePolicy)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		mux.ServeHTTP(w, r)
	}), nil
}
