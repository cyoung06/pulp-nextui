package helper

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// Credential rotation and bootstrap are one Job (a weekly CronJob, and a one-shot copy on install):
//
//  1. prepare (pulp-nextui): without "next" in the Secret, store a new one (the replace carries the
//     resourceVersion read, so it can't overwrite a concurrent change); write "next" to a file shared
//     with step 2.
//  2. Pulp's own image (pulpcore-manager shell): create the superuser if missing, set its password to
//     the file's content.
//  3. finish (pulp-nextui): if Pulp takes "next", promote it ("password" = "next", "next" removed);
//     then disable robots past their expiry.
//
// Every step can be repeated, and none needs the old password: a run that dies anywhere is finished
// by the next one, and a lost password is simply replaced. Between 2 and 3 the helper finds Pulp
// refusing "password" and uses "next" (pulpClient.admin).

const defaultAccount = "pulp-nextui"

func prepare(ctx context.Context, k *kube, ref secretRef, out string, log *slog.Logger) error {
	s, err := k.getSecret(ctx, ref.Namespace, ref.Name)
	if err != nil {
		return err
	}
	c := credentialsOf(s)
	if c.Next == "" || c.Username == "" {
		if c.Username == "" {
			s.Data["username"] = []byte(defaultAccount)
		}
		if c.Next == "" {
			s.Data["next"] = []byte(newSecret())
		}
		if err := k.replaceSecret(ctx, ref.Namespace, ref.Name, s); err != nil {
			return err
		}
		if s, err = k.getSecret(ctx, ref.Namespace, ref.Name); err != nil {
			return err
		}
		if c = credentialsOf(s); c.Next == "" {
			return errors.New("next vanished from the Secret")
		}
		log.Info("rotation: new password stored as next")
	}
	if err := os.WriteFile(out+"/username", []byte(c.Username), 0o640); err != nil {
		return err
	}
	return os.WriteFile(out+"/password", []byte(c.Next), 0o640)
}

func finish(ctx context.Context, k *kube, p *pulpClient, ref secretRef, log *slog.Logger) error {
	s, err := k.getSecret(ctx, ref.Namespace, ref.Name)
	if err != nil {
		return err
	}
	c := credentialsOf(s)
	if c.Next == "" {
		log.Info("rotation: nothing to promote")
		return nil
	}
	if _, err := p.send(ctx, http.MethodGet, "/pulp/api/v3/login/", nil, basic(c.Username, c.Next)); err != nil {
		return errors.New("Pulp does not take next yet (did the set-password step run?): " + err.Error())
	}
	s.Data["password"] = []byte(c.Next)
	delete(s.Data, "next")
	if err := k.replaceSecret(ctx, ref.Namespace, ref.Name, s); err != nil {
		return err
	}
	log.Info("rotation: done")
	return nil
}

// maintain runs after a rotation: pulp-nextui's robot roles exist as defined, and robots past their
// expiry are disabled.
func maintain(ctx context.Context, a *API, now time.Time) error {
	for _, t := range repositoryTypes {
		if err := a.ensureRole(ctx, t.pushRole, t.pushPermissions); err != nil {
			return err
		}
	}
	users, err := allPages[pulpUser](ctx, a.pulp, "/pulp/api/v3/users/"+query(map[string]string{
		"username__contains": robotPrefix, "is_active": "true", "limit": "200",
	}))
	if err != nil {
		return err
	}
	today := now.UTC().Format("2006-01-02")
	for _, u := range users {
		rb, ok := robotOf(u)
		if !ok || rb.Expires == "" || strings.Compare(rb.Expires, today) > 0 {
			continue
		}
		if err := a.pulp.admin(ctx, http.MethodPatch, u.Href, map[string]bool{"is_active": false}, nil); err != nil {
			return err
		}
		a.log.Info("robot expired: disabled", "robot", u.Username, "expires", rb.Expires)
	}
	return nil
}

// Rotate is "pulp-nextui rotate prepare|finish ...": steps 1 and 3 of the credentials Job. It returns
// the process exit code.
func Rotate(log *slog.Logger, args []string) int {
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
	if err := maintain(ctx, &API{pulp: p, log: log}, time.Now()); err != nil {
		log.Error("maintain", "err", err)
		return 1
	}
	return 0
}
