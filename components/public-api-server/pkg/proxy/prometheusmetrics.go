// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

func reportConnectionDuration(d time.Duration) {
	proxyConnectionCreateDurationSeconds.Observe(d.Seconds())
}

var (
	proxyConnectionCreateDurationSeconds = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: "gitpod",
		Subsystem: "public_api",
		Name:      "proxy_connection_create_duration_seconds",
		Help:      "Histogram of connection time in seconds",
	})

	connectionPoolSize = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: "gitpod",
		Subsystem: "public_api",
		Name:      "proxy_connection_pool_size",
		Help:      "Gauge of connections in connection pool",
	})

	connectionPoolCacheOutcome = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "public_api",
		Name:      "proxy_connection_pool_cache_outcomes_total",
		Help:      "Counter of cachce accesses",
	}, []string{"hit"})
)

func RegisterMetrics(registry *prometheus.Registry) {
	registry.MustRegister(proxyConnectionCreateDurationSeconds)
	registry.MustRegister(connectionPoolSize)
	registry.MustRegister(connectionPoolCacheOutcome)
}

func reportCacheOutcome(hit bool) {
	connectionPoolCacheOutcome.WithLabelValues(strconv.FormatBool(hit)).Inc()
}
