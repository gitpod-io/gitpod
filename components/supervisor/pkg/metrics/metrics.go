// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
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
	}
}

func (m *SupervisorMetrics) Register(registry *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		m.IDEReadyDurationTotal,
		m.InitializerHistogram,
	}

	for _, metric := range metrics {
		err := registry.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}
	return nil
}
