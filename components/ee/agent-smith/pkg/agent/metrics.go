// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"github.com/prometheus/client_golang/prometheus"
)

type metrics struct {
	penaltyAttempts                    *prometheus.CounterVec
	penaltyFailures                    *prometheus.CounterVec
	classificationBackpressureInCount  prometheus.Gauge
	classificationBackpressureOutCount prometheus.Gauge

	cl []prometheus.Collector
}

func newAgentMetrics() *metrics {
	m := &metrics{}

	m.penaltyAttempts = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "gitpod",
			Subsystem: "agent_smith",
			Name:      "penalty_attempts_total",
			Help:      "The total amount of attempts that agent-smith is trying to apply a penalty.",
		}, []string{"penalty"},
	)
	m.penaltyFailures = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "gitpod",
			Subsystem: "agent_smith",
			Name:      "penalty_attempts_failed_total",
			Help:      "The total amount of failed attempts that agent-smith is trying to apply a penalty.",
		}, []string{"penalty", "reason"},
	)
	m.classificationBackpressureInCount = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: "gitpod",
		Subsystem: "agent_smith",
		Name:      "classification_backpressure_in_count",
		Help:      "processes queued for classification",
	})
	m.classificationBackpressureOutCount = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: "gitpod",
		Subsystem: "agent_smith",
		Name:      "classification_backpressure_out_count",
		Help:      "processes coming out of classification",
	})
	m.cl = []prometheus.Collector{
		m.penaltyAttempts,
		m.penaltyFailures,
		m.classificationBackpressureInCount,
		m.classificationBackpressureOutCount,
	}
	return m
}

func (m *metrics) Describe(d chan<- *prometheus.Desc) {
	for _, c := range m.cl {
		c.Describe(d)
	}
}

func (m *metrics) Collect(d chan<- prometheus.Metric) {
	for _, c := range m.cl {
		c.Collect(d)
	}
}
