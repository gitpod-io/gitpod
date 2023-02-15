// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package origin

import (
	"context"
)

type contextKey int

const (
	originContextKey contextKey = iota
)

func ToContext(ctx context.Context, origin string) context.Context {
	return context.WithValue(ctx, originContextKey, origin)
}

func FromContext(ctx context.Context) string {
	if val, ok := ctx.Value(originContextKey).(string); ok {
		return val
	}

	return ""
}
