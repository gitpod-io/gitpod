// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"

	"github.com/containerd/containerd/remotes/docker"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/hashicorp/go-retryablehttp"
)

const authKey = "authKey"

func NewProxy(host *url.URL, aliases map[string]Repo, mirrorAuth func() docker.Authorizer) (*Proxy, error) {
	if host.Host == "" || host.Scheme == "" {
		return nil, fmt.Errorf("host Host or Scheme are missing")
	}
	for k, v := range aliases {
		// We need to translate the default hosts for the Docker registry.
		// If we don't do this, pulling from docker.io will fail.
		v.Host, _ = docker.DefaultHost(v.Host)
		aliases[k] = v
	}
	return &Proxy{
		Host:       *host,
		Aliases:    aliases,
		proxies:    make(map[string]*httputil.ReverseProxy),
		mirrorAuth: mirrorAuth,
	}, nil
}

type Proxy struct {
	Host    url.URL
	Aliases map[string]Repo

	mu         sync.Mutex
	proxies    map[string]*httputil.ReverseProxy
	mirrorAuth func() docker.Authorizer
}

type Repo struct {
	Host string
	Repo string
	Tag  string
	Auth func() docker.Authorizer
}

func rewriteDockerAPIURL(u *url.URL, fromRepo, toRepo, host, tag string) {
	var (
		from = "/v2/" + strings.Trim(fromRepo, "/") + "/"
		to   = "/v2/" + strings.Trim(toRepo, "/") + "/"
	)
	u.Path = to + strings.TrimPrefix(u.Path, from)

	// we reset the escaped encoding hint, because EscapedPath will produce a valid encoding.
	u.RawPath = ""

	if tag != "" {
		// We're forcing the image tag which only affects manifests. No matter what the user
		// requested we look at, we'll force the tag to the one we're given.
		segs := strings.Split(u.Path, "/")
		if len(segs) >= 2 && segs[len(segs)-2] == "manifests" {
			// We're on the manifest found, hence the last segment must be the reference.
			// Even if the reference is a digest, we'll just force it to the tag.
			// This might break some consumers, but we want to use the tag forcing as a means
			// of excerting control, hence rather break folks than allow unauthorized access.
			segs[len(segs)-1] = tag
			u.Path = strings.Join(segs, "/")
		}
	}

	u.Host = host
}

// rewriteNonDockerAPIURL is used when a url has to be rewritten but the url
// contains a non docker api path
func rewriteNonDockerAPIURL(u *url.URL, fromPrefix, toPrefix, host string) {
	var (
		from = "/" + strings.Trim(fromPrefix, "/") + "/"
		to   = "/" + strings.Trim(toPrefix, "/") + "/"
	)
	if fromPrefix == "" {
		from = "/"
	}
	if toPrefix == "" {
		to = "/"
	}
	u.Path = to + strings.TrimPrefix(u.Path, from)

	// we reset the escaped encoding hint, because EscapedPath will produce a valid encoding.
	u.RawPath = ""

	u.Host = host
}

// ServeHTTP serves the proxy
func (proxy *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var (
		repo  *Repo
		alias string
	)

	// bypass for crane check
	if r.URL.Path == "/v2/" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
		return
	}

	for k, v := range proxy.Aliases {
		// Docker api request
		if strings.HasPrefix(r.URL.Path, "/v2/"+k+"/") {
			repo = &v
			alias = k
			rewriteDockerAPIURL(r.URL, alias, repo.Repo, repo.Host, repo.Tag)
			break
		}
		// Non-Docker api request
		if strings.HasPrefix(r.URL.Path, "/"+k+"/") {
			// We will use the same repo/alias and its credentials but we will set target
			// repo as empty
			repo = &v
			alias = k
			rewriteNonDockerAPIURL(r.URL, alias, "", repo.Host)
			break
		}
	}

	// get mirror host
	if host := r.URL.Query().Get("ns"); host != "" && (r.Method == http.MethodGet || r.Method == http.MethodHead) {
		host, _ = docker.DefaultHost(host)

		r.URL.Host = host
		r.Host = host

		auth := proxy.mirrorAuth()
		r = r.WithContext(context.WithValue(ctx, authKey, auth))

		r.RequestURI = ""
		proxy.mirror(host).ServeHTTP(w, r)
		return
	}

	if repo == nil {
		http.Error(w, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}

	r.Host = r.URL.Host

	auth := repo.Auth()
	r = r.WithContext(context.WithValue(ctx, authKey, auth))

	err := auth.Authorize(ctx, r)
	if err != nil {
		log.WithError(err).Error("cannot authorize request")
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return
	}

	log.WithField("req", r.URL.Path).Info("serving request")

	r.RequestURI = ""
	proxy.reverse(alias).ServeHTTP(w, r)
}

// reverse produces an authentication-adding reverse proxy for a given repo alias
func (proxy *Proxy) reverse(alias string) *httputil.ReverseProxy {
	proxy.mu.Lock()
	defer proxy.mu.Unlock()

	if rp, ok := proxy.proxies[alias]; ok {
		return rp
	}

	repo, ok := proxy.Aliases[alias]
	if !ok {
		// we don't have an alias, hence don't know what to do other than try and proxy.
		// At this poing things will probably fail.
		return nil
	}
	rp := httputil.NewSingleHostReverseProxy(&url.URL{Scheme: "https", Host: repo.Host})

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
			// the docker authorizer only refreshes OAuth tokens after two
			// successive 401 errors for the same URL. Rather than issue the same
			// request multiple times to tickle the token-refreshing logic, just
			// provide the same response twice to trick it into refreshing the
			// cached OAuth token. Call AddResponses() twice, first to invalidate
			// the existing token (with two responses), second to fetch a new one
			// (with one response).
			// TODO: fix after one of these two PRs are merged and available:
			//     https://github.com/containerd/containerd/pull/8735
			//     https://github.com/containerd/containerd/pull/8388
			err := auth.AddResponses(ctx, []*http.Response{resp, resp})
			if err != nil {
				log.WithError(err).WithField("URL", resp.Request.URL.String()).Warn("cannot add responses although response was Unauthorized")
				return false, nil
			}

			err = auth.AddResponses(ctx, []*http.Response{resp})
			if err != nil {
				log.WithError(err).WithField("URL", resp.Request.URL.String()).Warn("cannot add responses although response was Unauthorized")
				return false, nil
			}

			return true, nil
		}
		if resp.StatusCode == http.StatusBadRequest {
			bodyBytes, err := io.ReadAll(resp.Body)
			if err != nil {
				log.WithError(err).WithField("URL", resp.Request.URL.String()).Warn("failed to read response body")
			}

			log.WithField("URL", resp.Request.URL.String()).WithField("Body", string(bodyBytes)).Warn("bad request")
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
		// 			   @link https://golang.org/src/net/http/httputil/reverseproxy.go
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
		// Some registries return a Location header which we must rewrite to still push
		// through this proxy.
		// We support only relative URLs and not absolute URLs.
		if loc := r.Header.Get("Location"); loc != "" {
			lurl, err := url.Parse(loc)
			if err != nil {
				return err
			}

			if strings.HasPrefix(loc, "/v2/") {
				rewriteDockerAPIURL(lurl, repo.Repo, alias, proxy.Host.Host, "")
			} else {
				// since this is a non docker api location we
				// do not need to process the path.
				// All docker api URLs always start with /v2/. See spec
				// https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints
				rewriteNonDockerAPIURL(lurl, "", alias, repo.Host)
			}

			lurl.Host = proxy.Host.Host
			// force scheme to http assuming this proxy never runs as https
			lurl.Scheme = proxy.Host.Scheme
			r.Header.Set("Location", lurl.String())
		}

		if r.StatusCode == http.StatusBadGateway {
			// BadGateway makes containerd retry - we don't want that because we retry the upstream
			// requests internally.
			r.StatusCode = http.StatusInternalServerError
			r.Status = http.StatusText(http.StatusInternalServerError)
		}

		return nil
	}
	proxy.proxies[alias] = rp
	return rp
}

// mirror produces an authentication-adding reverse proxy for given host
func (proxy *Proxy) mirror(host string) *httputil.ReverseProxy {
	proxy.mu.Lock()
	defer proxy.mu.Unlock()

	if rp, ok := proxy.proxies[host]; ok {
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
			// the docker authorizer only refreshes OAuth tokens after two
			// successive 401 errors for the same URL. Rather than issue the same
			// request multiple times to tickle the token-refreshing logic, just
			// provide the same response twice to trick it into refreshing the
			// cached OAuth token. Call AddResponses() twice, first to invalidate
			// the existing token (with two responses), second to fetch a new one
			// (with one response).
			// TODO: fix after one of these two PRs are merged and available:
			//     https://github.com/containerd/containerd/pull/8735
			//     https://github.com/containerd/containerd/pull/8388
			err := auth.AddResponses(ctx, []*http.Response{resp, resp})
			if err != nil {
				log.WithError(err).WithField("URL", resp.Request.URL.String()).Warn("cannot add responses although response was Unauthorized")
				return false, nil
			}

			err = auth.AddResponses(ctx, []*http.Response{resp})
			if err != nil {
				log.WithError(err).WithField("URL", resp.Request.URL.String()).Warn("cannot add responses although response was Unauthorized")
				return false, nil
			}
			return true, nil
		}
		if resp.StatusCode == http.StatusBadRequest {
			log.WithField("URL", resp.Request.URL.String()).Warn("bad request")
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
		// 			   @link https://golang.org/src/net/http/httputil/reverseproxy.go
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
	proxy.proxies[host] = rp
	return rp
}
