// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package logif

import (
	"github.com/caddyserver/caddy/v2/caddyconfig"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"go.uber.org/zap/zapcore"
)

// UnmarshalCaddyfile sets up the module form Caddyfile tokens.
//
// Syntax:
// if {
//     "<expression>"
// } [<encoder>]
//
// The <expression> must be on a single line.
// Refer to `lang.Lang` for its syntax.
//
// The <encoder> can be one of `json`, `jsonselector`, `console`.
// In case no <encoder> is specified, one between `json` and `console` is set up depending
// on the current environment.
func (ce *ConditionalEncoder) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	if d.Next() {
		if d.Val() != moduleName {
			return d.Errf("expecting %s (%T) subdirective", moduleID, ce)
		}
		var expression string
		if !d.Args(&expression) {
			return d.Errf("%s (%T) requires an expression", moduleID, ce)
		}

		ce.Expr = expression
	}

	if !d.Next() {
		return nil
	}

	// Delegate the parsing of the encoder to the encoder itself
	nextDispenser := d.NewFromNextSegment()
	if nextDispenser.Next() {
		moduleName := nextDispenser.Val()
		moduleID := "caddy.logging.encoders." + moduleName
		mod, err := caddyfile.UnmarshalModule(nextDispenser, moduleID)
		if err != nil {
			return err
		}
		enc, ok := mod.(zapcore.Encoder)
		if !ok {
			return d.Errf("module %s (%T) is not a zapcore.Encoder", moduleID, mod)
		}
		ce.EncRaw = caddyconfig.JSONModuleObject(enc, "format", moduleName, nil)
		ce.Formatter = moduleName
	}

	return nil
}
