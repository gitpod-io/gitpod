// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package metrics

import (
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
)

type SupervisorMetrics struct {
	IDEReadyDurationTotal *prometheus.HistogramVec
	InitializerHistogram  *prometheus.HistogramVec
	SSHTunnelOpenedTotal  *prometheus.CounterVec
	SSHTunnelClosedTotal  *prometheus.CounterVec
}

func NewMetrics() *SupervisorMetrics {
	return &SupervisorMetrics{
		IDEReadyDurationTotal: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "supervisor_ide_ready_duration_total",
			Help:    "the IDE startup time",
			Buckets: []float64{0.1, 0.5, 1, 1.5, 2, 2.5, 5, 10},
		}, []string{"kind"}),
		InitializerHistogram: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "supervisor_initializer_bytes_second",
			Help:    "initializer speed in bytes per second",
			Buckets: prometheus.ExponentialBuckets(1024*1024, 2, 12),
		}, []string{"kind"}),
		SSHTunnelOpenedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "supervisor_ssh_tunnel_opened_total",
			Help: "Total number of SSH tunnels opened by the supervisor",
		}, []string{}),
		SSHTunnelClosedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "supervisor_ssh_tunnel_closed_total",
			Help: "Total number of SSH tunnels closed by the supervisor",
		}, []string{"code"}),
	}
}

func (m *SupervisorMetrics) Register(registry *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		m.IDEReadyDurationTotal,
		m.InitializerHistogram,
		m.SSHTunnelOpenedTotal,
		m.SSHTunnelClosedTotal,
	}

	for _, metric := range metrics {
		err := registry.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}
	return nil
}
