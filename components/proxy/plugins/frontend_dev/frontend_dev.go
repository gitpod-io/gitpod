// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package frontend_dev

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"regexp"
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
	caddy.RegisterModule(FrontendDev{})
	httpcaddyfile.RegisterHandlerDirective(frontendDevModule, parseCaddyfile)
}

// FrontendDev implements an HTTP handler that extracts gitpod headers
type FrontendDev struct {
	Upstream    string `json:"upstream,omitempty"`
	UpstreamUrl *url.URL
}

// CaddyModule returns the Caddy module information.
func (FrontendDev) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.frontend_dev",
		New: func() caddy.Module { return new(FrontendDev) },
	}
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m FrontendDev) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
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

	director := func(req *http.Request) {
		req.URL.Scheme = m.UpstreamUrl.Scheme
		req.URL.Host = m.UpstreamUrl.Host
		req.Host = m.UpstreamUrl.Host
		if _, ok := req.Header["User-Agent"]; !ok {
			// explicitly disable User-Agent so it's not set to default value
			req.Header.Set("User-Agent", "")
		}
		req.Header.Set("Accept-Encoding", "") // we can't handle other than plain text
		// caddy.Log().Sugar().Infof("director request (mod): %v", req.URL.String())
	}
	proxy := httputil.ReverseProxy{Director: director, Transport: &RedirectingTransport{baseUrl: devURL}}
	proxy.ServeHTTP(w, r)

	return nil
}

type RedirectingTransport struct {
	baseUrl *url.URL
}

func (rt *RedirectingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// caddy.Log().Sugar().Infof("issuing upstream request: %s", req.URL.Path)
	resp, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	// gpl: Do we have better means to avoid checking the body?
	if resp.StatusCode < 300 && strings.HasPrefix(resp.Header.Get("Content-type"), "text/html") {
		// caddy.Log().Sugar().Infof("trying to match request: %s", req.URL.Path)
		modifiedResp := MatchAndRewriteRootRequest(resp, rt.baseUrl)
		if modifiedResp != nil {
			caddy.Log().Sugar().Debugf("using modified upstream response: %s", req.URL.Path)
			return modifiedResp, nil
		}
	}
	caddy.Log().Sugar().Debugf("forwarding upstream response: %s", req.URL.Path)

	return resp, nil
}

func MatchAndRewriteRootRequest(or *http.Response, baseUrl *url.URL) *http.Response {
	// match index.html?
	prefix := []byte("<!doctype html>")
	var buf bytes.Buffer
	bodyReader := io.TeeReader(or.Body, &buf)
	prefixBuf := make([]byte, len(prefix))
	_, err := io.ReadAtLeast(bodyReader, prefixBuf, len(prefix))
	if err != nil {
		caddy.Log().Sugar().Debugf("prefix match: can't read response body: %w", err)
		return nil
	}
	if !bytes.Equal(prefix, prefixBuf) {
		caddy.Log().Sugar().Debugf("prefix mismatch: %s", string(prefixBuf))
		return nil
	}

	caddy.Log().Sugar().Debugf("match index.html")
	_, err = io.Copy(&buf, or.Body)
	if err != nil {
		caddy.Log().Sugar().Debugf("unable to copy response body: %w, path: %s", err, or.Request.URL.Path)
		return nil
	}
	fullBody := buf.String()

	mainJs := regexp.MustCompile(`"[^"]+?main\.[0-9a-z]+\.js"`)
	fullBody = mainJs.ReplaceAllStringFunc(fullBody, func(s string) string {
		return fmt.Sprintf(`"%s/static/js/main.js"`, baseUrl.String())
	})

	mainCss := regexp.MustCompile(`<link[^>]+?rel="stylesheet">`)
	fullBody = mainCss.ReplaceAllString(fullBody, "")

	hrefs := regexp.MustCompile(`href="/`)
	fullBody = hrefs.ReplaceAllString(fullBody, fmt.Sprintf(`href="%s/`, baseUrl.String()))

	or.Body = io.NopCloser(strings.NewReader(fullBody))
	or.Header.Set("Content-Length", fmt.Sprintf("%d", len(fullBody)))
	or.Header.Set("Etag", "")
	return or
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *FrontendDev) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	if !d.Next() {
		return d.Err("expected token following filter")
	}

	for d.NextBlock(0) {
		key := d.Val()
		var value string
		d.Args(&value)
		if d.NextArg() {
			return d.ArgErr()
		}

		switch key {
		case "upstream":
			m.Upstream = value

		default:
			return d.Errf("unrecognized subdirective '%s'", value)
		}
	}

	if m.Upstream == "" {
		return fmt.Errorf("frontend_dev: 'upstream' config field may not be empty")
	}

	upstreamURL, err := url.Parse(m.Upstream)
	if err != nil {
		return fmt.Errorf("frontend_dev: 'upstream' is not a valid URL: %w", err)
	}
	m.UpstreamUrl = upstreamURL

	return nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	m := new(FrontendDev)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*FrontendDev)(nil)
	_ caddyfile.Unmarshaler       = (*FrontendDev)(nil)
)
