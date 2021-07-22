// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
package jsonselect

import (
	"strings"

	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
)

func (e *JSONSelectEncoder) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	for d.Next() {
		args := d.RemainingArgs()
		switch len(args) {
		case 0:
			return d.Errf("%s (%T) requires an argument", moduleID, e)
		default:
			e.Selector = strings.Join(args, " ")
		}

		for n := d.Nesting(); d.NextBlock(n); {
			subdir := d.Val()
			var arg string
			if !d.AllArgs(&arg) {
				return d.ArgErr()
			}
			switch subdir {
			case "message_key":
				e.MessageKey = &arg
			case "level_key":
				e.LevelKey = &arg
			case "time_key":
				e.TimeKey = &arg
			case "name_key":
				e.NameKey = &arg
			case "caller_key":
				e.CallerKey = &arg
			case "stacktrace_key":
				e.StacktraceKey = &arg
			case "line_ending":
				e.LineEnding = &arg
			case "time_format":
				e.TimeFormat = arg
			case "level_format":
				e.LevelFormat = arg
			default:
				return d.Errf("unrecognized subdirective %s", subdir)
			}
		}
	}
	return nil
}
