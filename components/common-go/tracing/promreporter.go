// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package tracing

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	jaeger "github.com/uber/jaeger-client-go"
)

// PromReporter reports Jaeger span durations to Prometheus
type PromReporter struct {
	Operations map[string]SpanMetricMapping

	metrics map[string]prometheus.Histogram
}

// SpanMetricMapping defines how a span is to be reported to Prometheus
type SpanMetricMapping struct {
	Name    string
	Help    string
	Buckets []float64
}

// RegisterMetrics registers all metrics created throug the mapping
func (r *PromReporter) RegisterMetrics() error {
	r.metrics = make(map[string]prometheus.Histogram)
	for k, m := range r.Operations {
		metric := prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    m.Name,
			Help:    m.Help,
			Buckets: m.Buckets,
		})
		err := prometheus.Register(metric)
		if err != nil {
			return err
		}

		r.metrics[k] = metric
	}
	return nil
}

// Report reports a span as Prometheus metric
func (r *PromReporter) Report(span *jaeger.Span) {
	metric, ok := r.metrics[span.OperationName()]
	if !ok {
		return
	}

	metric.Observe(float64(span.Duration() / time.Millisecond))
}

// Close implements Close() method of Reporter by closing each underlying reporter.
func (r *PromReporter) Close() {

}
