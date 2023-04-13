// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package analytics

import (
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"go.uber.org/zap"

	segment "gopkg.in/segmentio/analytics-go.v3"
)

const (
	moduleName = "gitpod.analytics"
)

func init() {
	caddy.RegisterModule(Analytics{})
	httpcaddyfile.RegisterHandlerDirective(moduleName, parseCaddyfile)
}

type segmentProxy struct {
	segmentKey string
	http.Handler
}

type Analytics struct {
	trustedProxy   *segmentProxy
	untrustedProxy *segmentProxy
}

// CaddyModule returns the Caddy module information.
func (Analytics) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.gitpod_analytics",
		New: func() caddy.Module { return new(Analytics) },
	}
}

// Provision implements caddy.Provisioner.
func (a *Analytics) Provision(ctx caddy.Context) error {
	logger := ctx.Logger(a)

	segmentEndponit, err := url.Parse(segment.DefaultEndpoint)
	if err != nil {
		logger.Error("failed to parse segment endpoint", zap.Error(err))
		return nil
	}

	errorLog, err := zap.NewStdLogAt(logger, zap.ErrorLevel)
	if err != nil {
		logger.Error("failed to create error log", zap.Error(err))
		return nil
	}

	untrustedSegmentKey := os.Getenv("ANALYTICS_PLUGIN_UNTRUSTED_SEGMENT_KEY")
	if untrustedSegmentKey != "" {
		a.untrustedProxy = newSegmentProxy(segmentEndponit, errorLog, untrustedSegmentKey)
	}

	trustedSegmentKey := os.Getenv("ANALYTICS_PLUGIN_TRUSTED_SEGMENT_KEY")
	if trustedSegmentKey != "" {
		a.trustedProxy = newSegmentProxy(segmentEndponit, errorLog, trustedSegmentKey)
	}

	return nil
}

func newSegmentProxy(segmentEndponit *url.URL, errorLog *log.Logger, segmentKey string) *segmentProxy {
	reverseProxy := httputil.NewSingleHostReverseProxy(segmentEndponit)
	reverseProxy.ErrorLog = errorLog

	// configure transport to ensure that requests
	// can be processed without staling connections
	reverseProxy.Transport = &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          0,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	return &segmentProxy{
		segmentKey: segmentKey,
		Handler:    http.StripPrefix("/analytics", reverseProxy),
	}
}

func (a *Analytics) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	segmentKey, _, ok := r.BasicAuth()
	if !ok {
		return next.ServeHTTP(w, r)
	}
	if a.trustedProxy != nil && segmentKey == a.trustedProxy.segmentKey {
		a.trustedProxy.ServeHTTP(w, r)
		return nil
	}
	if a.untrustedProxy != nil && (segmentKey == "" || segmentKey == a.untrustedProxy.segmentKey) {
		if segmentKey == "" {
			r.SetBasicAuth(a.untrustedProxy.segmentKey, "")
		}
		a.untrustedProxy.ServeHTTP(w, r)
		return nil
	}
	return next.ServeHTTP(w, r)
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *Analytics) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	return nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	m := new(Analytics)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*Analytics)(nil)
	_ caddyfile.Unmarshaler       = (*Analytics)(nil)
)
