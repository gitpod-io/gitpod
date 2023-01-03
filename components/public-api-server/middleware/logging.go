// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package middleware

import (
	"github.com/sirupsen/logrus"
	"net/http"
	"time"
)

type Middleware func(handler http.Handler) http.Handler

func NewLoggingMiddleware(l *logrus.Entry) Middleware {

	return func(next http.Handler) http.Handler {
		logging := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			uri := r.RequestURI
			method := r.Method
			duration := time.Since(start)
			next.ServeHTTP(w, r)

			l.WithFields(logrus.Fields{
				"uri":      uri,
				"method":   method,
				"duration": duration,
			}).Infof("Handled HTTP request %s %s", method, uri)
		})

		return logging
	}
}
