package helper

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// kube is the part of the Kubernetes API pulp-nextui uses: get and replace one Secret, as the pod's
// service account. Replacing sends the resourceVersion that was read, so a write based on a stale
// read fails (409) instead of overwriting someone else's.
type kube struct {
	base   string
	token  string
	client *http.Client
}

const serviceAccountDir = "/var/run/secrets/kubernetes.io/serviceaccount"

func inCluster() (*kube, error) {
	host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
	if host == "" || port == "" {
		return nil, errors.New("not running in a Kubernetes pod (KUBERNETES_SERVICE_HOST unset)")
	}
	token, err := os.ReadFile(serviceAccountDir + "/token")
	if err != nil {
		return nil, err
	}
	ca, err := os.ReadFile(serviceAccountDir + "/ca.crt")
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return nil, errors.New("no CA certificate in " + serviceAccountDir + "/ca.crt")
	}
	return &kube{
		base:  "https://" + net.JoinHostPort(host, port),
		token: strings.TrimSpace(string(token)),
		client: &http.Client{Timeout: 15 * time.Second, Transport: &http.Transport{
			TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12},
		}},
	}, nil
}

// secretObject keeps metadata as read, so a replace carries the resourceVersion and everything else
// back unchanged. Data values are base64 in JSON, which []byte encodes and decodes.
type secretObject struct {
	APIVersion string            `json:"apiVersion"`
	Kind       string            `json:"kind"`
	Metadata   map[string]any    `json:"metadata"`
	Type       string            `json:"type,omitempty"`
	Data       map[string][]byte `json:"data"`
}

var errConflict = errors.New("the secret changed since it was read")

func (k *kube) do(ctx context.Context, method, path string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, k.base+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+k.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := k.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusConflict {
		return errConflict
	}
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("kubernetes %s %s: %s %s", method, path, resp.Status, strings.TrimSpace(string(data)))
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

func secretPath(namespace, name string) string {
	return "/api/v1/namespaces/" + namespace + "/secrets/" + name
}

func (k *kube) getSecret(ctx context.Context, namespace, name string) (*secretObject, error) {
	var s secretObject
	if err := k.do(ctx, http.MethodGet, secretPath(namespace, name), nil, &s); err != nil {
		return nil, err
	}
	if s.Data == nil {
		s.Data = map[string][]byte{}
	}
	return &s, nil
}

func (k *kube) replaceSecret(ctx context.Context, namespace, name string, s *secretObject) error {
	return k.do(ctx, http.MethodPut, secretPath(namespace, name), s, nil)
}
