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
	// static key for untrusted segment requests
	dummyUntrustedSegmentKey = "untrusted-dummy-key"
)

func init() {
	caddy.RegisterModule(Analytics{})
	httpcaddyfile.RegisterHandlerDirective(moduleName, parseCaddyfile)
}

type Analytics struct {
	segmentProxy        http.Handler
	trustedSegmentKey   string
	untrustedSegmentKey string
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

	segmentEndpoint, err := resolveSegmenEndpoint()
	if err != nil {
		logger.Error("failed to parse segment endpoint", zap.Error(err))
		return nil
	}

	errorLog, err := zap.NewStdLogAt(logger, zap.ErrorLevel)
	if err != nil {
		logger.Error("failed to create error log", zap.Error(err))
		return nil
	}

	a.segmentProxy = newSegmentProxy(segmentEndpoint, errorLog)
	a.untrustedSegmentKey = os.Getenv("ANALYTICS_PLUGIN_UNTRUSTED_SEGMENT_KEY")
	a.trustedSegmentKey = os.Getenv("ANALYTICS_PLUGIN_TRUSTED_SEGMENT_KEY")

	return nil
}

func resolveSegmenEndpoint() (*url.URL, error) {
	segmentEndpoint := os.Getenv("ANALYTICS_PLUGIN_SEGMENT_ENDPOINT")
	if segmentEndpoint == "" {
		segmentEndpoint = segment.DefaultEndpoint
	}
	return url.Parse(segmentEndpoint)
}

func newSegmentProxy(segmentEndpoint *url.URL, errorLog *log.Logger) http.Handler {
	reverseProxy := httputil.NewSingleHostReverseProxy(segmentEndpoint)
	reverseProxy.ErrorLog = errorLog
	reverseProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		// the default error handler is:
		// func (p *ReverseProxy) defaultErrorHandler(rw http.ResponseWriter, req *http.Request, err error) {
		// 	p.logf("http: proxy error: %v", err)
		// 	rw.WriteHeader(http.StatusBadGateway)
		// }
		//
		// proxy returns 502 to clients when supervisor is having trouble, which is a signal the user experience is degraded
		//
		// this change makes it so that we return 503 when there is trouble with the /analytics endpoint
		reverseProxy.ErrorLog.Printf("http: proxy error: %v", err)
		w.WriteHeader(http.StatusServiceUnavailable)
	}

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
	return http.StripPrefix("/analytics", reverseProxy)
}

func (a *Analytics) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	segmentKey, _, _ := r.BasicAuth()
	shouldProxyToTrustedSegment := a.trustedSegmentKey != "" && segmentKey == a.trustedSegmentKey
	if shouldProxyToTrustedSegment {
		a.segmentProxy.ServeHTTP(w, r)
		return nil
	}
	shouldProxyToUntrustedSegment := a.untrustedSegmentKey != "" && (segmentKey == "" || segmentKey == dummyUntrustedSegmentKey)
	if shouldProxyToUntrustedSegment {
		r.SetBasicAuth(a.untrustedSegmentKey, "")
		a.segmentProxy.ServeHTTP(w, r)
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
