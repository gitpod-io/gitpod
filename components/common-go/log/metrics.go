// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package log

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

var (
	DefaultMetrics = NewMetrics()
)

type Metrics struct {
	logEmitedCounter *prometheus.CounterVec
}

func (m *Metrics) ReportLog(level logrus.Level) {
	m.logEmitedCounter.WithLabelValues(level.String()).Inc()
}

func NewMetrics() *Metrics {
	return &Metrics{
		logEmitedCounter: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "gitpod_logs_total",
			Help: "Total number of logs produced by level",
		}, []string{"level"}),
	}
}

// Describe sends the super-set of all possible descriptors of metrics
// collected by this Collector to the provided channel and returns once
// the last descriptor has been sent.
func (m *Metrics) Describe(ch chan<- *prometheus.Desc) {
	m.logEmitedCounter.Describe(ch)
}

// Collect is called by the Prometheus registry when collecting
// metrics. The implementation sends each collected metric via the
// provided channel and returns once the last metric has been sent.
func (m *Metrics) Collect(ch chan<- prometheus.Metric) {
	m.logEmitedCounter.Collect(ch)
}

func NewLogHook(metrics *Metrics) *LogHook {
	return &LogHook{metrics: metrics}
}

type LogHook struct {
	metrics *Metrics
}

func (h *LogHook) Levels() []logrus.Level {
	return logrus.AllLevels
}

func (h *LogHook) Fire(entry *logrus.Entry) error {
	h.metrics.ReportLog(entry.Level)
	return nil
}
