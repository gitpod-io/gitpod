// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspacedownload

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

const (
	workspaceDownloadModule = "gitpod.workspace_download"
)

func init() {
	caddy.RegisterModule(Download{})
	httpcaddyfile.RegisterHandlerDirective(workspaceDownloadModule, parseCaddyfile)
}

// Download implements an HTTP handler that extracts gitpod headers
type Download struct {
	Service string `json:"service,omitempty"`
}

// CaddyModule returns the Caddy module information.
func (Download) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.gitpod_workspace_download",
		New: func() caddy.Module { return new(Download) },
	}
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m Download) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	origReq := r.Context().Value(caddyhttp.OriginalRequestCtxKey).(http.Request)

	query := r.URL.RawQuery
	if query != "" {
		query = "?" + query
	}

	url := fmt.Sprintf("%v%v%v", m.Service, origReq.URL.Path, query)
	client := http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("Server Error: cannot download token OTS")
	}

	// pass browser headers
	// TODO (aledbf): check if it's possible to narrow the list
	for k, vv := range r.Header {
		for _, v := range vv {
			req.Header.Add(k, v)
		}
	}

	// override content-type
	req.Header.Set("Content-Type", "*/*")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Server Error: cannot download token OTS")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Bad Request: /workspace-download/get returned with code %v", resp.StatusCode)
	}

	upstreamURLBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("server error: cannot obtain workspace download URL")
	}
	upstreamURL := string(upstreamURLBytes)

	// perform the upstream request here
	resp, err = http.Get(upstreamURL)
	if err != nil {
		caddy.Log().Sugar().Errorf("error starting download of workspace for %v: %v", upstreamURL, err)
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error downloading workspace"))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		caddy.Log().Sugar().Errorf("invalid status code downloading workspace for %v: %v", upstreamURL, resp.StatusCode)
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error downloading workspace"))
	}

	brw := newNoBufferResponseWriter(w)
	_, err = io.Copy(brw, resp.Body)
	if err != nil {
		caddy.Log().Sugar().Errorf("error proxying workspace download for %v: %v", upstreamURL, err)
		return caddyhttp.Error(http.StatusInternalServerError, fmt.Errorf("unexpected error downloading workspace"))
	}

	return next.ServeHTTP(w, r)
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *Download) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
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
	m := new(Download)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*Download)(nil)
	_ caddyfile.Unmarshaler       = (*Download)(nil)
)

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