// pulp-nextui serves a web UI for Pulp (https://pulpproject.org) under /ui/, on Pulp's own origin:
// the UI calls Pulp's API with the browser's Pulp session. With -pulp it also serves the helper API
// (/ui/api/: CLI secrets, robot accounts); "pulp-nextui rotate ..." is the job that creates and
// rotates the Pulp account the helper acts as.
package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/cyoung06/pulp-nextui/internal/helper"
	"github.com/cyoung06/pulp-nextui/internal/web"
)

var version = "dev"

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if len(os.Args) > 1 && os.Args[1] == "rotate" {
		os.Exit(helper.Rotate(log, os.Args[2:]))
	}
	var cfg web.Config
	listen := flag.String("listen", ":8080", "listen address (plain HTTP; TLS terminates at the gateway)")
	pulpURL := flag.String("pulp", "", "Pulp's API inside the cluster, e.g. http://pulp-api-svc:24817: turns on the helper API (/ui/api/: CLI secrets, robot accounts); empty: off")
	secret := flag.String("credentials-secret", "", "namespace/name of the Secret with the Pulp admin account the helper acts as (username, password[, next])")
	origin := flag.String("origin", "", "the public origin, e.g. https://pulp.example.org; helper requests with another Origin are refused")
	flag.StringVar(&cfg.Title, "title", "Pulp", "name shown in the sidebar and the tab title")
	flag.StringVar(&cfg.APIBase, "api-base", "/pulp/api/v3/", "path of Pulp's REST API on this origin")
	flag.StringVar(&cfg.LoginURL, "login-url", "", "where \"Sign in\" sends the browser: Pulp's login entry, e.g. its social-auth OIDC URL (required)")
	flag.StringVar(&cfg.LoginProvider, "login-provider", "", "the sign-in provider's name for the button, e.g. \"Keycloak\" (empty: \"Sign in\")")
	flag.Func("plugins", "content types to show, comma-separated: python,npm,maven,container (default: all that Pulp has)", func(v string) error {
		for _, p := range strings.Split(v, ",") {
			if p = strings.TrimSpace(p); p != "" {
				cfg.Plugins = append(cfg.Plugins, p)
			}
		}
		return nil
	})
	flag.Parse()
	if cfg.LoginURL == "" {
		log.Error("-login-url is required")
		os.Exit(2)
	}
	var routes func(*http.ServeMux)
	if *pulpURL != "" {
		h, err := helper.New(*pulpURL, *secret, *origin, log)
		if err != nil {
			log.Error("helper", "err", err)
			os.Exit(1)
		}
		routes, cfg.Helper = h.Routes, true
	}
	h, err := web.Handler(web.UI(), cfg, routes)
	if err != nil {
		log.Error("ui", "err", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	srv := &http.Server{Addr: *listen, Handler: h, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: time.Minute}
	go func() { <-ctx.Done(); srv.Close() }()
	log.Info("pulp-nextui listening", "addr", *listen, "version", version)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Error("serve", "err", err)
		os.Exit(1)
	}
}
