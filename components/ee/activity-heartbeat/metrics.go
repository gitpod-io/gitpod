package main

import "github.com/prometheus/client_golang/prometheus"

type metrics struct {
	currentlyConsideredPIDS prometheus.Gauge
}

func NewActiviyHeartbeatMetrics() *metrics {
	m := &metrics{}

	m.currentlyConsideredPIDS = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "gitpod",
			Subsystem: "acitivity_heartbeat",
			Name:      "currently_considered_pids",
			Help:      "Number of currently considered PIDs",
		},
	)
	return m
}

func (m *metrics) Register(reg prometheus.Registerer) {
	reg.MustRegister(m.currentlyConsideredPIDS)
}
