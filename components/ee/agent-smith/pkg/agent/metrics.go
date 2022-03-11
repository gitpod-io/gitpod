// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"sync"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/detector"
	"github.com/prometheus/client_golang/prometheus"
)

type metrics struct {
	penaltyAttempts                    *prometheus.CounterVec
	penaltyFailures                    *prometheus.CounterVec
	classificationBackpressureInCount  prometheus.GaugeFunc
	classificationBackpressureOutCount prometheus.GaugeFunc
	classificationBackpressureInDrop   prometheus.Counter
	egressViolations                   *prometheus.CounterVec

	mu sync.RWMutex
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
	m.egressViolations = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "gitpod",
			Subsystem: "agent_smith",
			Name:      "egress_violations_total",
			Help:      "The total amount of egress violations that agent-smith discovered.",
		}, []string{"severity"},
	)
	m.classificationBackpressureInDrop = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "agent_smith",
		Name:      "classification_backpressure_in_drop_total",
		Help:      "total count of processes that went unclassified because of backpressure",
	})
	m.cl = []prometheus.Collector{
		m.penaltyAttempts,
		m.penaltyFailures,
		m.classificationBackpressureInDrop,
		m.egressViolations,
	}
	return m
}

func (m *metrics) RegisterClassificationQueues(in chan detector.Process, out chan classifiedProcess) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.classificationBackpressureInCount = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: "gitpod",
		Subsystem: "agent_smith",
		Name:      "classification_backpressure_in_count",
		Help:      "processes queued for classification",
	}, func() float64 { return float64(len(in)) })
	m.classificationBackpressureOutCount = prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: "gitpod",
		Subsystem: "agent_smith",
		Name:      "classification_backpressure_out_count",
		Help:      "processes coming out of classification",
	}, func() float64 { return float64(len(out)) })
}

func (m *metrics) Describe(d chan<- *prometheus.Desc) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.classificationBackpressureInCount != nil {
		m.classificationBackpressureInCount.Describe(d)
	}
	if m.classificationBackpressureOutCount != nil {
		m.classificationBackpressureOutCount.Describe(d)
	}
	for _, c := range m.cl {
		c.Describe(d)
	}
}

func (m *metrics) Collect(d chan<- prometheus.Metric) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.classificationBackpressureInCount != nil {
		m.classificationBackpressureInCount.Collect(d)
	}
	if m.classificationBackpressureOutCount != nil {
		m.classificationBackpressureOutCount.Collect(d)
	}
	for _, c := range m.cl {
		c.Collect(d)
	}
}
