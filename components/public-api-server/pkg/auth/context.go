// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import "context"

type contextKey int

const (
	authContextKey contextKey = iota
)

func TokenToContext(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, authContextKey, token)
}

func TokenFromContext(ctx context.Context) string {
	if val, ok := ctx.Value(authContextKey).(string); ok {
		return val
	}

	return ""
}
