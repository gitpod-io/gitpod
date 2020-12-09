// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import "github.com/prometheus/client_golang/prometheus"

type metrics struct {
	setpointGauge   prometheus.Gauge
	ghostCountGauge prometheus.Gauge
}

func newMetrics() *metrics {
	return &metrics{
		setpointGauge: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "driver_setpoint",
			Help: "setpoint of the scaler driver",
		}),
		ghostCountGauge: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "ghost_count",
			Help: "current number of Ghost workspaces scaler is aware of",
		}),
	}
}

// Register registers all metrics scaler can export
func (m *metrics) Register(reg prometheus.Registerer) error {
	if m == nil {
		return nil
	}

	collectors := []prometheus.Collector{
		m.setpointGauge,
		m.ghostCountGauge,
	}
	for _, c := range collectors {
		err := reg.Register(c)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *metrics) OnSetpointChange(v int) {
	if m == nil {
		return
	}
	m.setpointGauge.Set(float64(v))
}

func (m *metrics) OnGhostCountChange(v int) {
	if m == nil {
		return
	}
	m.ghostCountGauge.Set(float64(v))
}
