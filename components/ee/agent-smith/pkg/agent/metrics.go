// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import "github.com/prometheus/client_golang/prometheus"

type metrics struct {
	penaltyAttempts        *prometheus.CounterVec
	penaltyFailures        *prometheus.CounterVec
	signatureCheckMiss     prometheus.Counter
	signatureCheckFailures prometheus.Counter
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
	m.signatureCheckMiss = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "agent_smith",
		Name:      "signature_check_missed_total",
		Help:      "The total amount of times where the processes ended before we could open the executable.",
	})
	m.signatureCheckFailures = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "agent_smith",
		Name:      "signature_check_failed_total",
		Help:      "The total amount of failed signature check attempts",
	})
	return m
}

func (m *metrics) Register(reg prometheus.Registerer) error {
	if m == nil {
		return nil
	}

	collectors := []prometheus.Collector{
		m.penaltyAttempts,
		m.penaltyFailures,
		m.signatureCheckMiss,
		m.signatureCheckFailures,
	}
	for _, c := range collectors {
		err := reg.Register(c)
		if err != nil {
			return err
		}
	}

	return nil
}
