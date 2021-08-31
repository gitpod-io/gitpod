// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package bodyintercept

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

const (
	bodyInterceptModule = "gitpod.body_intercept"
)

func init() {
	caddy.RegisterModule(BodyIntercept{})
	httpcaddyfile.RegisterHandlerDirective(bodyInterceptModule, parseCaddyfile)
}

type BodyIntercept struct {
	Search  string `json:"search,omitempty"`
	Replace string `json:"replace,omitempty"`
}

// CaddyModule returns the Caddy module information.
func (BodyIntercept) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.gitpod_body_intercept",
		New: func() caddy.Module { return new(BodyIntercept) },
	}
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m BodyIntercept) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	buf := new(bytes.Buffer)
	shouldBufferFunc := func(status int, header http.Header) bool {
		contentType := header.Get("Content-Type")
		return strings.HasPrefix(contentType, "application/json")
	}
	rec := caddyhttp.NewResponseRecorder(w, buf, shouldBufferFunc)
	err := next.ServeHTTP(rec, r)
	if err != nil {
		return err
	}
	if !rec.Buffered() {
		fmt.Printf("Skipping replacing '%s' in request '%s %s' because content type is not 'application/json' but '%s'.\n", m.Search, r.Method, r.URL.Path, rec.Header().Get("Content-Type"))
		return nil
	}

	origSize := buf.Len()
	bodyBytes := buf.Bytes()
	body := strings.ReplaceAll(string(bodyBytes), m.Search, m.Replace)
	buf.Reset()
	_, err = buf.Write([]byte(body))
	if err != nil {
		return err
	}
	newSize := buf.Len()
	fmt.Printf("Tried to replace '%s' in request '%s %s'. Original body size: %d. New body size: %d.\n", m.Search, r.Method, r.URL.Path, origSize, newSize)

	rec.Header().Del("Content-Length")

	return rec.WriteResponse()
}

// UnmarshalCaddyfile implements caddyfile.Unmarshaler.
func (m *BodyIntercept) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
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
		case "search":
			m.Search = value
		case "replace":
			m.Replace = value
		default:
			return d.Errf("unrecognized subdirective '%s'", d.Val())
		}
	}

	if m.Search == "" {
		return fmt.Errorf("Please configure the search subdirective")
	}
	if m.Replace == "" {
		return fmt.Errorf("Please configure the replace subdirective")
	}

	return nil
}

// parseCaddyfile unmarshals tokens from h into a new Middleware.
func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	var m BodyIntercept
	err := m.UnmarshalCaddyfile(h.Dispenser)
	return m, err
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*BodyIntercept)(nil)
	_ caddyfile.Unmarshaler       = (*BodyIntercept)(nil)
)
