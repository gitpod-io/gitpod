// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"

	"github.com/containerd/containerd/remotes/docker"
	"github.com/gitpod-io/gitpod/common-go/log"
)

func NewForwardProxy(authorizer func() docker.Authorizer, scheme string) (*ForwardProxy, error) {
	return &ForwardProxy{
		authorizer: authorizer,
		scheme:     scheme,
		proxies:    make(map[string]*httputil.ReverseProxy),
	}, nil
}

// ForwardProxy acts as forward proxy, injecting authentication to requests
// It uses the same docker-specific retry-and-authenticate logic as the reverse/mirror proxy in proxy.go
type ForwardProxy struct {
	authorizer func() docker.Authorizer
	scheme     string

	mu      sync.Mutex
	proxies map[string]*httputil.ReverseProxy
}

// ServeHTTP serves the proxy
func (p *ForwardProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Prepare for forwarding
	r.RequestURI = ""

	auth := p.authorizer()
	r = r.WithContext(context.WithValue(ctx, CONTEXT_KEY_AUTHORIZER, auth)) // auth might be used in the forward proxy below

	err := auth.Authorize(ctx, r)
	if err != nil {
		log.WithError(err).Error("cannot authorize request")
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return
	}

	// Construct target URL
	targetUrl, err := parseTargetURL(r.Host, p.scheme)
	if err != nil {
		log.WithError(err).Error("cannot parse host to determine target URL")
		http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}
	p.authenticatingProxy(targetUrl).ServeHTTP(w, r)
}

func parseTargetURL(targetHost string, scheme string) (*url.URL, error) {
	// to safely parse the URL, we need to make sure it has a scheme
	parts := strings.Split(targetHost, "://")
	if len(parts) == 1 {
		targetHost = scheme + "://" + parts[0]
	} else if len(parts) == 2 {
		targetHost = scheme + "://" + parts[1]
	} else {
		targetHost = scheme + "://" + parts[len(parts)-1]
	}
	targetUrl, err := url.Parse(targetHost)
	if err != nil {
		return nil, err
	}

	return targetUrl, nil
}

func (p *ForwardProxy) authenticatingProxy(targetUrl *url.URL) *httputil.ReverseProxy {
	p.mu.Lock()
	defer p.mu.Unlock()

	if rp, ok := p.proxies[targetUrl.Host]; ok {
		return rp
	}
	rp := createAuthenticatingReverseProxy(targetUrl)
	p.proxies[targetUrl.Host] = rp
	return rp
}
