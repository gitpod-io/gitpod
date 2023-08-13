// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"

	"github.com/containerd/containerd/remotes/docker"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/hashicorp/go-retryablehttp"
)

func NewRegistryMirror(auth Authorizer) *RegistryMirror {
	return &RegistryMirror{
		Auth:    auth,
		proxies: make(map[string]*httputil.ReverseProxy),
	}
}

type RegistryMirror struct {
	Auth Authorizer

	mu      sync.Mutex
	proxies map[string]*httputil.ReverseProxy
}

// ServeHTTP serves the proxy
func (mirror *RegistryMirror) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("ns")
	if ns == "" {
		http.Error(w, "no namespace (ns query parameter) present", http.StatusBadRequest)
	}

	auth := docker.NewDockerAuthorizer(docker.WithAuthCreds(mirror.Auth.Authorize))
	r = r.WithContext(context.WithValue(r.Context(), authKey, auth))

	r.RequestURI = ""

	mirror.reverse(ns).ServeHTTP(w, r)
}

// reverse produces an authentication-adding reverse proxy for a given repo alias
func (mirror *RegistryMirror) reverse(host string) *httputil.ReverseProxy {
	mirror.mu.Lock()
	defer mirror.mu.Unlock()

	if rp, ok := mirror.proxies[host]; ok {
		return rp
	}

	rp := httputil.NewSingleHostReverseProxy(&url.URL{Scheme: "https", Host: host})

	client := retryablehttp.NewClient()
	client.RetryMax = 3
	client.CheckRetry = func(ctx context.Context, resp *http.Response, err error) (bool, error) {
		if err != nil {
			log.WithError(err).Warn("saw error during CheckRetry")
			return false, err
		}
		auth, ok := ctx.Value(authKey).(docker.Authorizer)
		if !ok || auth == nil {
			return false, nil
		}
		if resp.StatusCode == http.StatusUnauthorized {
			err := auth.AddResponses(context.Background(), []*http.Response{resp})
			if err != nil {
				log.WithError(err).WithField("URL", resp.Request.URL.String()).Warn("cannot add responses although response was Unauthorized")
				return false, nil
			}
			return true, nil
		}

		return false, nil
	}
	client.RequestLogHook = func(l retryablehttp.Logger, r *http.Request, i int) {
		// Total hack: we need a place to modify the request before retrying, and this log
		//             hook seems to be the only place. We need to modify the request, because
		//             maybe we just added the host authorizer in the previous CheckRetry call.
		//
		//			   The ReverseProxy sets the X-Forwarded-For header with the host machine
		//			   address. If on a cluster with IPV6 enabled, this will be "::1" (IPV6 equivalent
		//			   of "127.0.0.1"). This can have the knock-on effect of receiving an IPV6
		//			   URL, e.g. auth.ipv6.docker.com instead of auth.docker.com which may not
		//			   exist. By forcing the value to be "127.0.0.1", we ensure consistency
		//			   across clusters.
		//
		// 			   @link https://golang.org/src/net/http/httputil/reversemirror.go
		r.Header.Set("X-Forwarded-For", "127.0.0.1")

		auth, ok := r.Context().Value(authKey).(docker.Authorizer)
		if !ok || auth == nil {
			return
		}
		_ = auth.Authorize(r.Context(), r)
	}
	client.ResponseLogHook = func(l retryablehttp.Logger, r *http.Response) {}

	rp.Transport = &retryablehttp.RoundTripper{
		Client: client,
	}
	rp.ModifyResponse = func(r *http.Response) error {
		if r.StatusCode == http.StatusBadGateway {
			// BadGateway makes containerd retry - we don't want that because we retry the upstream
			// requests internally.
			r.StatusCode = http.StatusInternalServerError
			r.Status = http.StatusText(http.StatusInternalServerError)
		}

		return nil
	}
	mirror.proxies[host] = rp
	return rp
}
