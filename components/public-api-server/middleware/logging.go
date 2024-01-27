// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package middleware

import (
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
)

type Middleware func(handler http.Handler) http.Handler

func NewLoggingMiddleware() Middleware {
	return func(next http.Handler) http.Handler {
		logging := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := log.ToContext(r.Context(), log.Log.WithContext(r.Context()))
			log.AddFields(ctx, logrus.Fields{
				"protocol": "http",
				"uri":      r.RequestURI,
				"method":   r.Method,
			})

			start := time.Now()
			next.ServeHTTP(w, r)
			duration := time.Since(start)

			log.AddFields(ctx, logrus.Fields{
				"duration_seconds": duration.Seconds(),
			})
			log.Extract(ctx).Debug("Handled HTTP request")
		})

		return logging
	}
}
