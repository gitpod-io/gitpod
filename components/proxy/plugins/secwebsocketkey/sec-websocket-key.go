// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package secwebsocketkey

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

const (
	secWebsocketKeyHeader = "Sec-WebSocket-Key"
	secWebsocketKeyModule = "gitpod.sec_websocket_key"
)

func init() {
	caddy.RegisterModule(SecWebsocketKey{})
	httpcaddyfile.RegisterHandlerDirective(secWebsocketKeyModule, parseWebsocketCaddyfile)
}

// SecWebsocketKey implements an HTTP handler that adds a random sec-websocket-key if the header is missing
type SecWebsocketKey struct {
	BaseDomain string `json:"base_domain,omitempty"`
	Debug      bool   `json:"debug,omitempty"`
}

// CaddyModule returns the Caddy module information.
func (SecWebsocketKey) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.gitpod_sec_websocket_key",
		New: func() caddy.Module { return new(SecWebsocketKey) },
	}
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (m SecWebsocketKey) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	key := r.Header.Get(secWebsocketKeyHeader)
	if key == "" {
		buf := make([]byte, 20)
		_, err := rand.Read(buf)
		if err != nil {
			return err
		}
		randomKey := base64.StdEncoding.EncodeToString(buf)
		r.Header.Set(secWebsocketKeyHeader, randomKey)
	}

	return next.ServeHTTP(w, r)
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *SecWebsocketKey) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	return nil
}

func parseWebsocketCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	m := new(SecWebsocketKey)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*SecWebsocketKey)(nil)
	_ caddyfile.Unmarshaler       = (*SecWebsocketKey)(nil)
)
