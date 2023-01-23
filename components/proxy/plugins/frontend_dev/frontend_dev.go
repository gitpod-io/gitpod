// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspacedownload

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

const (
	frontendDevModule            = "gitpod.frontend_dev"
	devURLHeaderName             = "X-Frontend-Dev-URL"
	frontendDevEnabledEnvVarName = "FRONTEND_DEV_ENABLED"
)

func init() {
	caddy.RegisterModule(Config{})
	httpcaddyfile.RegisterHandlerDirective(frontendDevModule, parseCaddyfile)
}

// Config implements an HTTP handler that extracts gitpod headers
type Config struct {
}

// CaddyModule returns the Caddy module information.
func (Config) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.frontend_dev",
		New: func() caddy.Module { return new(Config) },
	}
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m Config) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	enabled := os.Getenv(frontendDevEnabledEnvVarName)
	if enabled != "true" {
		caddy.Log().Sugar().Debugf("Dev URL header present but disabled")
		return caddyhttp.Error(http.StatusBadRequest, fmt.Errorf("frontend dev module disabled"))
	}

	devURLStr := r.Header.Get(devURLHeaderName)
	if devURLStr == "" {
		caddy.Log().Sugar().Errorf("Dev URL header empty")
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error forwarding to dev URL"))
	}
	devURL, err := url.Parse(devURLStr)
	if err != nil {
		caddy.Log().Sugar().Errorf("Cannot parse dev URL")
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error forwarding to dev URL"))
	}

	targetQuery := devURL.RawQuery
	director := func(req *http.Request) {
		req.URL.Scheme = devURL.Scheme
		req.URL.Host = devURL.Host
		req.Host = devURL.Host // override host header so target proxy can handle this request properly

		req.URL.Path, req.URL.RawPath = joinURLPath(devURL, req.URL)
		if targetQuery == "" || req.URL.RawQuery == "" {
			req.URL.RawQuery = targetQuery + req.URL.RawQuery
		} else {
			req.URL.RawQuery = targetQuery + "&" + req.URL.RawQuery
		}
		if _, ok := req.Header["User-Agent"]; !ok {
			// explicitly disable User-Agent so it's not set to default value
			req.Header.Set("User-Agent", "")
		}
	}
	proxy := httputil.ReverseProxy{Director: director}
	proxy.ServeHTTP(w, r)

	return nil
}

func joinURLPath(a, b *url.URL) (path, rawpath string) {
	if a.RawPath == "" && b.RawPath == "" {
		return singleJoiningSlash(a.Path, b.Path), ""
	}
	// Same as singleJoiningSlash, but uses EscapedPath to determine
	// whether a slash should be added
	apath := a.EscapedPath()
	bpath := b.EscapedPath()

	aslash := strings.HasSuffix(apath, "/")
	bslash := strings.HasPrefix(bpath, "/")

	switch {
	case aslash && bslash:
		return a.Path + b.Path[1:], apath + bpath[1:]
	case !aslash && !bslash:
		return a.Path + "/" + b.Path, apath + "/" + bpath
	}
	return a.Path + b.Path, apath + bpath
}

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *Config) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {

	return nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	m := new(Config)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*Config)(nil)
	_ caddyfile.Unmarshaler       = (*Config)(nil)
)
