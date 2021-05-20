// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package plugins

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"github.com/rs/cors"
)

const (
	corsOriginModule = "gitpod.cors_origin"
)

func init() {
	caddy.RegisterModule(CorsOrigin{})
	httpcaddyfile.RegisterHandlerDirective(corsOriginModule, parseCorsOriginfile)
}

// CorsOrigin implements an HTTP handler that generates a valid CORS Origin value
type CorsOrigin struct {
	BaseDomain string `json:"base_domain,omitempty"`
	Debug      bool   `json:"debug,omitempty"`
}

// CaddyModule returns the Caddy module information.
func (CorsOrigin) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.gitpod_cors_origin",
		New: func() caddy.Module { return new(CorsOrigin) },
	}
}

var (
	allowedMethods = []string{http.MethodPost, http.MethodGet, http.MethodDelete, http.MethodOptions}
	allowedHeaders = []string{"Accept", "Authorization", "Cache-Control", "Content-Type", "DNT", "Keep-Alive", "Origin", "User-Agent",
		"If-Match", "If-Modified-Since", "If-None-Match",
		"X-Requested-With", "X-Account-Type", "X-Client-Commit", "X-Client-Name", "X-Client-Version", "X-Execution-Id", "X-Machine-Id", "X-Machine-Session-Id", "X-User-Session-Id",
	}
	exposeHeaders = []string{"Authorization", "etag", "x-operation-id", "retry-after"}
)

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m CorsOrigin) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*." + m.BaseDomain},
		AllowedMethods:   allowedMethods,
		AllowedHeaders:   allowedHeaders,
		ExposedHeaders:   exposeHeaders,
		AllowCredentials: true,
		MaxAge:           60,
		Debug:            m.Debug,
	})

	c.ServeHTTP(w, r,
		func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		},
	)

	return nil
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *CorsOrigin) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
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
		case "base_domain":
			m.BaseDomain = value
		case "debug":
			b, err := strconv.ParseBool(value)
			if err != nil {
				return d.Errf("invalid boolean value for subdirective debug '%s'", value)
			}

			m.Debug = b
		default:
			return d.Errf("unrecognized subdirective '%s'", value)
		}
	}

	if m.BaseDomain == "" {
		return fmt.Errorf("Please configure the base_domain subdirective")
	}

	return nil
}

func parseCorsOriginfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	m := new(CorsOrigin)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*CorsOrigin)(nil)
	_ caddyfile.Unmarshaler       = (*CorsOrigin)(nil)
)
