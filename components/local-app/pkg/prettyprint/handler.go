// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package prettyprint

import (
	"context"
	"fmt"
	"log/slog"
)

var _ slog.Handler = &Handler{}

type Handler struct {
	Attrs    []slog.Attr
	LogLevel slog.Level
}

// Enabled implements slog.Handler.
func (h *Handler) Enabled(ctx context.Context, lvl slog.Level) bool {
	return lvl >= h.LogLevel
}

// Handle implements slog.Handler.
func (h *Handler) Handle(ctx context.Context, req slog.Record) error {
	fmt.Printf("[%s] %s\n", req.Level, req.Message)
	return nil
}

// WithAttrs implements slog.Handler.
func (h *Handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	h.Attrs = append(h.Attrs, attrs...)
	return &Handler{
		Attrs:    attrs,
		LogLevel: h.LogLevel,
	}
}

// WithGroup implements slog.Handler.
func (h *Handler) WithGroup(name string) slog.Handler {
	return h
}
