// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package metrics

import (
	"net/http"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"golang.org/x/xerrors"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func init() {
	caddy.RegisterModule(Metrics{})
	httpcaddyfile.RegisterHandlerDirective("caddy.metrics", parseCaddyfile)
}

// Metrics is a module that serves a /metrics endpoint so that any gathered
// metrics can be exposed for scraping. This module is configurable by end-users
// unlike AdminMetrics.
type Metrics struct {
	metricsHandler http.Handler
	registry       *prometheus.Registry
}

// CaddyModule returns the Caddy module information.
func (Metrics) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.caddy.metrics",
		New: func() caddy.Module { return new(Metrics) },
	}
}

// Provision sets up m.
func (m *Metrics) Provision(ctx caddy.Context) error {
	m.registry = prometheus.NewRegistry()

	err := m.registry.Register(collectors.NewGoCollector())
	if err != nil {
		return xerrors.Errorf("unexpected error registering prometheus collector: %w", err)
	}

	err = m.registry.Register(collectors.NewProcessCollector(
		collectors.ProcessCollectorOpts{},
	))
	if err != nil {
		return xerrors.Errorf("unexpected error registering prometheus collector: %w", err)
	}

	m.metricsHandler = promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})

	return nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	var m Metrics
	err := m.UnmarshalCaddyfile(h.Dispenser)
	return m, err
}

// UnmarshalCaddyfile sets up the handler from Caddyfile tokens. Syntax:
//
//     metrics [<matcher>] {
//     }
//
func (m *Metrics) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	for d.Next() {
		args := d.RemainingArgs()
		if len(args) > 0 {
			return d.ArgErr()
		}

		for d.NextBlock(0) {
			switch d.Val() {
			default:
				return d.Errf("unrecognized subdirective %q", d.Val())
			}
		}
	}
	return nil
}

func (m Metrics) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	m.metricsHandler.ServeHTTP(w, r)
	return nil
}

// Interface guards
var (
	_ caddy.Provisioner           = (*Metrics)(nil)
	_ caddyhttp.MiddlewareHandler = (*Metrics)(nil)
	_ caddyfile.Unmarshaler       = (*Metrics)(nil)
)
