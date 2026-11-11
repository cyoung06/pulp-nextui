package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"
)

// credentials of the Pulp account pulp-nextui acts as for what Pulp lets only admins do: create robot
// users and set passwords. They live in a Kubernetes Secret (keys username, password and, during a
// rotation, next) that only the rotate job writes.
type credentials struct {
	Username string
	Password string
	Next     string
}

func credentialsOf(s *secretObject) credentials {
	return credentials{
		Username: strings.TrimSpace(string(s.Data["username"])),
		Password: strings.TrimSpace(string(s.Data["password"])),
		Next:     strings.TrimSpace(string(s.Data["next"])),
	}
}

// secretRef is "namespace/name".
type secretRef struct{ Namespace, Name string }

func parseSecretRef(v string) (secretRef, error) {
	ns, name, ok := strings.Cut(v, "/")
	if !ok || ns == "" || name == "" || strings.Contains(name, "/") {
		return secretRef{}, fmt.Errorf("%q: want namespace/name", v)
	}
	return secretRef{ns, name}, nil
}

// pulpClient talks to Pulp's API inside the cluster, either as the admin account (credentials read
// from the Secret; read again whenever Pulp refuses them, so a rotation is picked up at once) or as a
// browser's user, by passing on that browser's session cookie.
type pulpClient struct {
	base   string // e.g. http://pulp-api-svc:24817
	http   *http.Client
	kube   *kube
	secret secretRef
	cached atomic.Pointer[credentials]
}

func newPulpClient(base string, k *kube, ref secretRef) *pulpClient {
	return &pulpClient{base: strings.TrimRight(base, "/"), http: &http.Client{Timeout: 60 * time.Second}, kube: k, secret: ref}
}

// pulpError is a refusal from Pulp: its status and its body (DRF's {"detail": ...} or field errors).
type pulpError struct {
	Status int
	Body   []byte
}

func (e *pulpError) Error() string {
	return fmt.Sprintf("pulp answered %d: %s", e.Status, strings.TrimSpace(string(e.Body)))
}

func isStatus(err error, status int) bool {
	var pe *pulpError
	return errors.As(err, &pe) && pe.Status == status
}

func (p *pulpClient) send(ctx context.Context, method, path string, body any, auth func(*http.Request)) ([]byte, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.base+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	auth(req)
	resp, err := p.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode/100 != 2 {
		return nil, &pulpError{resp.StatusCode, data}
	}
	return data, nil
}

func decode(data []byte, out any) error {
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

func basic(username, password string) func(*http.Request) {
	return func(r *http.Request) { r.SetBasicAuth(username, password) }
}

// admin calls Pulp as the admin account. On a 401 it reads the Secret again and tries its password,
// then next (a rotation may have changed Pulp's password before promoting next in the Secret).
func (p *pulpClient) admin(ctx context.Context, method, path string, body, out any) error {
	if c := p.cached.Load(); c != nil {
		data, err := p.send(ctx, method, path, body, basic(c.Username, c.Password))
		if !isStatus(err, http.StatusUnauthorized) {
			if err != nil {
				return err
			}
			return decode(data, out)
		}
	}
	s, err := p.kube.getSecret(ctx, p.secret.Namespace, p.secret.Name)
	if err != nil {
		return err
	}
	c := credentialsOf(s)
	for _, password := range []string{c.Password, c.Next} {
		if password == "" {
			continue
		}
		data, err := p.send(ctx, method, path, body, basic(c.Username, password))
		if isStatus(err, http.StatusUnauthorized) {
			continue
		}
		p.cached.Store(&credentials{Username: c.Username, Password: password})
		if err != nil {
			return err
		}
		return decode(data, out)
	}
	return errors.New("pulp refuses pulp-nextui's credentials (Secret " + p.secret.Namespace + "/" + p.secret.Name + ")")
}

// asUser calls Pulp as the browser that made r: with its session cookie and nothing else.
func (p *pulpClient) asUser(ctx context.Context, r *http.Request, method, path string, out any) error {
	cookie, err := r.Cookie("sessionid")
	if err != nil {
		return &pulpError{http.StatusUnauthorized, []byte(`{"detail":"Not signed in."}`)}
	}
	data, err := p.send(ctx, method, path, nil, func(req *http.Request) {
		req.AddCookie(&http.Cookie{Name: "sessionid", Value: cookie.Value})
	})
	if err != nil {
		return err
	}
	return decode(data, out)
}

// Pulp objects pulp-nextui reads.

type pulpPage[T any] struct {
	Count   int    `json:"count"`
	Next    string `json:"next"`
	Results []T    `json:"results"`
}

type pulpUser struct {
	Href       string `json:"pulp_href"`
	ID         int    `json:"id"`
	Username   string `json:"username"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	IsStaff    bool   `json:"is_staff"`
	IsActive   bool   `json:"is_active"`
	DateJoined string `json:"date_joined"`
}

type pulpRole struct {
	Href        string   `json:"pulp_href"`
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

func query(values map[string]string) string {
	q := url.Values{}
	for k, v := range values {
		q.Set(k, v)
	}
	return "?" + q.Encode()
}

// allPages follows a list's next links (Pulp gives absolute URLs; only their path and query are used).
func allPages[T any](ctx context.Context, p *pulpClient, path string) ([]T, error) {
	var items []T
	for path != "" {
		var page pulpPage[T]
		if err := p.admin(ctx, http.MethodGet, path, nil, &page); err != nil {
			return nil, err
		}
		items = append(items, page.Results...)
		path = ""
		if page.Next != "" {
			u, err := url.Parse(page.Next)
			if err != nil {
				return nil, err
			}
			path = u.RequestURI()
		}
	}
	return items, nil
}

// newSecret is 32 random bytes, base64url: a password for a robot or a member's CLI secret.
func newSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand does not fail on supported platforms
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
