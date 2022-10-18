// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"github.com/prometheus/client_golang/prometheus"
	"time"
)

func reportConnectionDuration(d time.Duration) {
	proxyConnectionCreateDurationSeconds.Observe(d.Seconds())
}

var proxyConnectionCreateDurationSeconds = prometheus.NewHistogram(prometheus.HistogramOpts{
	Namespace: "gitpod",
	Name:      "public_api_proxy_connection_create_duration_seconds",
	Help:      "Histogram of connection time in seconds",
})

func RegisterMetrics(registry *prometheus.Registry) {
	registry.MustRegister(proxyConnectionCreateDurationSeconds)
}
