// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"net/http"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
)

const (
	metricsNamespace = "gitpod"
	metricsSubsystem = "ws_proxy"
)

type httpMetrics struct {
	requestsTotal    *prometheus.CounterVec
	requestsDuration *prometheus.HistogramVec
}

func (m *httpMetrics) Describe(ch chan<- *prometheus.Desc) {
	m.requestsTotal.Describe(ch)
	m.requestsDuration.Describe(ch)
}

func (m *httpMetrics) Collect(ch chan<- prometheus.Metric) {
	m.requestsTotal.Collect(ch)
	m.requestsDuration.Collect(ch)
}

var (
	serverMetrics = &httpMetrics{
		requestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "http_server_requests_total",
			Help:      "Total number of incoming HTTP requests",
		}, []string{"method", "resource", "code", "http_version"}),
		requestsDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "http_server_requests_duration_seconds",
			Help:      "Duration of incoming HTTP requests in seconds",
			Buckets:   []float64{.005, .025, .05, .1, .5, 1, 2.5, 5, 30, 60, 120, 240, 600},
		}, []string{"method", "resource", "code", "http_version"}),
	}
	clientMetrics = &httpMetrics{
		requestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "http_client_requests_total",
			Help:      "Total number of outgoing HTTP requests",
		}, []string{"method", "resource", "code", "http_version"}),
		requestsDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubsystem,
			Name:      "http_client_requests_duration_seconds",
			Help:      "Duration of outgoing HTTP requests in seconds",
			Buckets:   []float64{.005, .025, .05, .1, .5, 1, 2.5, 5, 30, 60, 120, 240, 600},
		}, []string{"method", "resource", "code", "http_version"}),
	}
)

func init() {
	metrics.Registry.MustRegister(serverMetrics, clientMetrics)
}

type contextKey int

var (
	resourceKey    = contextKey(0)
	httpVersionKey = contextKey(1)
)

func withResourceMetricsLabel(r *http.Request, resource string) *http.Request {
	ctx := context.WithValue(r.Context(), resourceKey, []string{resource})
	return r.WithContext(ctx)
}

func withResourceLabel() promhttp.Option {
	return promhttp.WithLabelFromCtx("resource", func(ctx context.Context) string {
		if v := ctx.Value(resourceKey); v != nil {
			if resources, ok := v.([]string); ok {
				if len(resources) > 0 {
					return resources[0]
				}
			}
		}
		return "unknown"
	})
}

func withHttpVersionMetricsLabel(r *http.Request) *http.Request {
	ctx := context.WithValue(r.Context(), httpVersionKey, []string{r.Proto})
	return r.WithContext(ctx)
}

func withHttpVersionLabel() promhttp.Option {
	return promhttp.WithLabelFromCtx("http_version", func(ctx context.Context) string {
		if v := ctx.Value(httpVersionKey); v != nil {
			if versions, ok := v.([]string); ok {
				if len(versions) > 0 {
					return versions[0]
				}
			}
		}
		return "unknown"
	})
}

func instrumentClientMetrics(transport http.RoundTripper) http.RoundTripper {
	return promhttp.InstrumentRoundTripperCounter(clientMetrics.requestsTotal,
		promhttp.InstrumentRoundTripperDuration(clientMetrics.requestsDuration,
			transport,
			withResourceLabel(),
			withHttpVersionLabel(),
		),
		withResourceLabel(),
		withHttpVersionLabel(),
	)
}

func instrumentServerMetrics(next http.Handler) http.Handler {
	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		next.ServeHTTP(w, req)
		if v := req.Context().Value(resourceKey); v != nil {
			if resources, ok := v.([]string); ok {
				if len(resources) > 0 {
					resources[0] = getHandlerResource(req)
				}
			}
		}
		if v := req.Context().Value(httpVersionKey); v != nil {
			if versions, ok := v.([]string); ok {
				if len(versions) > 0 {
					versions[0] = req.Proto
				}
			}
		}
	})
	instrumented := promhttp.InstrumentHandlerCounter(serverMetrics.requestsTotal,
		promhttp.InstrumentHandlerDuration(serverMetrics.requestsDuration,
			handler,
			withResourceLabel(),
			withHttpVersionLabel(),
		),
		withResourceLabel(),
		withHttpVersionLabel(),
	)
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := context.WithValue(req.Context(), resourceKey, []string{"unknown"})
		ctx = context.WithValue(ctx, httpVersionKey, []string{"unknown"})
		instrumented.ServeHTTP(w, req.WithContext(ctx))
	})
}

func getHandlerResource(req *http.Request) string {
	hostPart := getResourceHost(req)
	if hostPart == "" {
		hostPart = "unknown"
		log.WithField("URL", req.URL).Warn("client metrics: cannot determine resource host part")
	}

	routePart := ""
	if route := mux.CurrentRoute(req); route != nil {
		routePart = route.GetName()
	}
	if routePart == "" {
		log.WithField("URL", req.URL).Warn("client metrics: cannot determine resource route part")
		routePart = "unknown"
	}
	if routePart == "root" {
		routePart = ""
	} else {
		routePart = "/" + routePart
	}
	return hostPart + routePart
}

func getResourceHost(req *http.Request) string {
	coords := getWorkspaceCoords(req)

	var parts []string

	if coords.Foreign {
		parts = append(parts, "foreign_content")
	}

	if coords.ID != "" {
		workspacePart := "workspace"
		if coords.Debug {
			workspacePart = "debug_" + workspacePart
		}
		if coords.Port != "" {
			workspacePart += "_port"
		}
		parts = append(parts, workspacePart)
	}
	return strings.Join(parts, "/")
}
