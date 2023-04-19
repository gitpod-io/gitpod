// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package metrics

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gorilla/websocket"
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

type HttpMetrics struct {
	httpRequestsTotal                *prometheus.CounterVec
	httpRequestsDuration             *prometheus.HistogramVec
	webSocketConnectionAttemptsTotal *prometheus.CounterVec
}

func NewHttpMetrics() *HttpMetrics {
	return &HttpMetrics{
		httpRequestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "supervisor_http_requests_total",
			Help: "Total number of HTTP requests",
		}, []string{"method", "resource", "status"}),
		httpRequestsDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "supervisor_http_requests_duration_seconds",
			Help: "Duration of HTTP requests in seconds",
			// it should be aligned with https://github.com/gitpod-io/gitpod/blob/196a109eee50bfb7da2c6b858a3e78f2a2d0b26f/install/installer/pkg/components/ide-metrics/configmap.go#L199
			Buckets: []float64{.005, .025, .05, .1, .5, 1, 2.5, 5, 30, 60, 120, 240, 600},
		}, []string{"method", "resource", "status"}),
		webSocketConnectionAttemptsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "supervisor_websocket_connection_attempts_total",
			Help: "Total number of WebSocket connection attempts",
		}, []string{"resource", "status"}),
	}
}

func (metrics *HttpMetrics) Describe(ch chan<- *prometheus.Desc) {
	metrics.httpRequestsTotal.Describe(ch)
	metrics.httpRequestsDuration.Describe(ch)
	metrics.webSocketConnectionAttemptsTotal.Describe(ch)
}

func (metrics *HttpMetrics) Collect(ch chan<- prometheus.Metric) {
	metrics.httpRequestsTotal.Collect(ch)
	metrics.httpRequestsDuration.Collect(ch)
	metrics.webSocketConnectionAttemptsTotal.Collect(ch)
}

func (metrics *HttpMetrics) ToResource(path string) string {
	return path
}

func (metrics *HttpMetrics) Track(transport http.RoundTripper) http.RoundTripper {
	// TODO remove only for debugging
	log.Info("instrumenting http transport")
	return &instrumentedTransport{
		metrics:   metrics,
		transport: transport,
	}
}

type instrumentedTransport struct {
	metrics   *HttpMetrics
	transport http.RoundTripper
}

func (t *instrumentedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	start := time.Now()
	resp, err := t.transport.RoundTrip(req)

	resource := t.metrics.ToResource(req.URL.Path)
	statusCode := http.StatusBadGateway
	if resp != nil {
		statusCode = resp.StatusCode
	}

	// TODO remove only for debugging
	log.Infof("http request %s %s %d %f", req.Method, resource, statusCode, time.Since(start).Seconds())

	if websocket.IsWebSocketUpgrade(req) {
		t.metrics.webSocketConnectionAttemptsTotal.WithLabelValues(resource, fmt.Sprintf("%d", statusCode)).Inc()
	} else {
		t.metrics.httpRequestsTotal.WithLabelValues(req.Method, resource, fmt.Sprintf("%d", statusCode)).Inc()
		t.metrics.httpRequestsDuration.WithLabelValues(req.Method, resource, fmt.Sprintf("%d", statusCode)).Observe(time.Since(start).Seconds())
	}

	return resp, err
}
