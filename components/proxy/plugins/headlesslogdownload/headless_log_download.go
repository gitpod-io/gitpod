// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspacedownload

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

const (
	headlessLogDownloadModule = "gitpod.headless_log_download"
)

func init() {
	caddy.RegisterModule(HeadlessLogDownload{})
	httpcaddyfile.RegisterHandlerDirective(headlessLogDownloadModule, parseCaddyfile)
}

// HeadlessLogDownload implements an HTTP handler that extracts gitpod headers
type HeadlessLogDownload struct {
	Service string `json:"service,omitempty"`
}

// CaddyModule returns the Caddy module information.
func (HeadlessLogDownload) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.gitpod_headless_log_download",
		New: func() caddy.Module { return new(HeadlessLogDownload) },
	}
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m HeadlessLogDownload) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	query := r.URL.RawQuery
	if query != "" {
		query = "?" + query
	}

	// server has an endpoint on the same path that returns the
	origReq := r.Context().Value(caddyhttp.OriginalRequestCtxKey).(http.Request)
	u := fmt.Sprintf("%v%v%v", m.Service, origReq.URL.Path, query)

	client := http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		caddy.Log().Sugar().Errorf("cannot download URL %v: %w", u, err)
		return fmt.Errorf("Server Error: cannot download headless log")
	}

	// pass browser headers
	// TODO (aledbf): check if it's possible to narrow the list
	for k, vv := range r.Header {
		for _, v := range vv {
			req.Header.Add(k, v)
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Server Error: cannot download headless log")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Bad Request: /headless-log-download/get returned with code %v", resp.StatusCode)
	}

	redirectURLBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		caddy.Log().Sugar().Errorf("cannot obtain headless log redirect URL: %v", err)
		return fmt.Errorf("server error: cannot obtain headless log redirect URL")
	}
	redirectURL, err := url.Parse(string(redirectURLBytes))
	if err != nil {
		caddy.Log().Sugar().Errorf("cannot parse redirectURL %v: %v", string(redirectURLBytes), err)
		return fmt.Errorf("cannot parse redirectURL")
	}

	resp, err = http.Get(redirectURL.String())
	if err != nil {
		caddy.Log().Sugar().Errorf("error starting download of prebuild log for %v: %v", redirectURL.String(), err)
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error downloading prebuild log"))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		caddy.Log().Sugar().Errorf("invalid status code downloading prebuild log for %v: %v", redirectURL.String(), resp.StatusCode)
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error downloading prebuild log"))
	}

	brw := newNoBufferResponseWriter(w)
	_, err = io.Copy(brw, resp.Body)
	if err != nil {
		caddy.Log().Sugar().Errorf("error downloading prebuild log for %v: %v", redirectURL.String(), err)
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error downloading prebuild log"))
	}

	return next.ServeHTTP(w, r)
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *HeadlessLogDownload) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
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
		case "service":
			m.Service = value
		default:
			return d.Errf("unrecognized subdirective '%s'", d.Val())
		}
	}

	if m.Service == "" {
		return fmt.Errorf("Please configure the service subdirective")
	}

	return nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	m := new(HeadlessLogDownload)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*HeadlessLogDownload)(nil)
	_ caddyfile.Unmarshaler       = (*HeadlessLogDownload)(nil)
)

// noBufferWriter ResponseWriter that allow an HTTP handler to flush buffered data to the client.
type noBufferWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

func newNoBufferResponseWriter(w http.ResponseWriter) *noBufferWriter {
	writer := &noBufferWriter{
		w: w,
	}
	if flusher, ok := w.(http.Flusher); ok {
		writer.flusher = flusher
	}
	return writer
}

func (n *noBufferWriter) Write(p []byte) (written int, err error) {
	written, err = n.w.Write(p)
	if n.flusher != nil {
		n.flusher.Flush()
	}

	return
}
