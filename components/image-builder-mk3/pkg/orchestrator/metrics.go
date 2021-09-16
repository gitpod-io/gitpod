// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrator

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
)

// RegisterMetrics registers the metrics of this builder
func (o *Orchestrator) RegisterMetrics(reg prometheus.Registerer) error {
	err := reg.Register(o.metrics.imageBuildsDoneTotal)
	if err != nil {
		return err
	}
	err = reg.Register(o.metrics.imageBuildsStartedTotal)
	if err != nil {
		return err
	}
	return nil
}

const (
	metricsNamespace = "gitpod"
	metricsSubsystem = "image_builder"
)

type metrics struct {
	imageBuildsDoneTotal    *prometheus.CounterVec
	imageBuildsStartedTotal prometheus.Counter
}

func newMetrics() *metrics {
	return &metrics{
		imageBuildsDoneTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "builds_done_total",
		}, []string{"success"}),
		imageBuildsStartedTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "builds_started_total",
		}),
	}
}

func (m *metrics) BuildDone(success bool) {
	m.imageBuildsDoneTotal.WithLabelValues(strconv.FormatBool(success)).Inc()
}

func (m *metrics) BuildStarted() {
	m.imageBuildsStartedTotal.Inc()
}
