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
	headlessLogDownloadModule = "gitpod.headless_log_download"
	redirectURLVariable       = "http." + headlessLogDownloadModule + "_url"
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
	repl := r.Context().Value(caddy.ReplacerCtxKey).(*caddy.Replacer)

	query := r.URL.RawQuery
	if query != "" {
		query = "?" + query
	}

	// server has an endpoint on the same path that returns the
	url := fmt.Sprintf("%v%v%v", m.Service, r.URL.Path, query)
	client := http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("Server Error: cannot download headless log")
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
		return fmt.Errorf("Server Error: cannot download headless log")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Bad Request: /headless-log-download/get returned with code %v", resp.StatusCode)
	}

	redirectURL, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("Server error: cannot obtain headless log redirect URL")
	}
	repl.Set(redirectURLVariable, string(redirectURL))

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
