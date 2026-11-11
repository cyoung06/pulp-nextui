// pulp-nextui serves a web UI for Pulp (https://pulpproject.org): the static export of web/,
// embedded, under /ui/, plus /ui/config.json telling it where Pulp's API is and where to sign in.
// It runs on the same origin as Pulp, behind the same gateway or proxy: the UI calls Pulp's API
// with the browser's Pulp session, so this server has no API, holds no secrets and makes no
// network calls.
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
)

var version = "dev"

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if len(os.Args) > 1 && os.Args[1] == "rotate" {
		os.Exit(runRotate(log, os.Args[2:]))
	}
	var cfg Config
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
	var helper *api
	if *pulpURL != "" {
		ref, err := parseSecretRef(*secret)
		if err != nil {
			log.Error("-credentials-secret", "err", err)
			os.Exit(2)
		}
		k, err := inCluster()
		if err != nil {
			log.Error("helper", "err", err)
			os.Exit(1)
		}
		helper = &api{pulp: newPulpClient(*pulpURL, k, ref), origin: strings.TrimRight(*origin, "/"), log: log}
		cfg.Helper = true
	}
	h, err := Handler(UI(), cfg, helper)
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

// runRotate is "pulp-nextui rotate prepare|finish": steps 1 and 3 of the credentials Job (rotate.go).
func runRotate(log *slog.Logger, args []string) int {
	if len(args) == 0 || (args[0] != "prepare" && args[0] != "finish") {
		log.Error("usage: pulp-nextui rotate prepare|finish ...")
		return 2
	}
	step := args[0]
	fs := flag.NewFlagSet("rotate "+step, flag.ExitOnError)
	pulpURL := fs.String("pulp", "", "Pulp's API inside the cluster, e.g. http://pulp-api-svc:24817 (finish)")
	secret := fs.String("credentials-secret", "", "namespace/name of the helper's credentials Secret (required)")
	out := fs.String("out", "", "directory to write username and the new password to, for the set-password step (prepare)")
	fs.Parse(args[1:])
	ref, err := parseSecretRef(*secret)
	if err != nil || (step == "finish" && *pulpURL == "") || (step == "prepare" && *out == "") {
		log.Error("rotate "+step+": missing flags", "err", err)
		return 2
	}
	k, err := inCluster()
	if err != nil {
		log.Error("rotate", "err", err)
		return 1
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if step == "prepare" {
		if err := prepare(ctx, k, ref, *out, log); err != nil {
			log.Error("rotate prepare", "err", err)
			return 1
		}
		return 0
	}
	p := newPulpClient(*pulpURL, k, ref)
	if err := finish(ctx, k, p, ref, log); err != nil {
		log.Error("rotate finish", "err", err)
		return 1
	}
	if err := maintain(ctx, &api{pulp: p, log: log}, time.Now()); err != nil {
		log.Error("maintain", "err", err)
		return 1
	}
	return 0
}
