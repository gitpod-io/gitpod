// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
)

func reportRequestWithJWT(jwtPresent bool) {
	requestsWithJWTSessionsTotal.WithLabelValues(strconv.FormatBool(jwtPresent)).Inc()
}

var (
	requestsWithJWTSessionsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "public_api",
		Name:      "requests_with_jwt_sessions_total",
		Help:      "Count of sessions with, or without JWT sessions",
	}, []string{"with_jwt"})
)

func RegisterMetrics(registry *prometheus.Registry) {
	registry.MustRegister(requestsWithJWTSessionsTotal)
}
