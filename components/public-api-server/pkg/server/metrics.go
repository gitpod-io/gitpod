// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/prometheus/client_golang/prometheus"
)

type ConnectMetrics struct {
	ServerRequestsStarted *prometheus.CounterVec
	ServerRequestsHandled *prometheus.HistogramVec

	ClientRequestsStarted *prometheus.CounterVec
	ClientRequestsHandled *prometheus.HistogramVec
}

func (m *ConnectMetrics) Register(registry *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		m.ServerRequestsStarted,
		m.ServerRequestsHandled,
		m.ClientRequestsStarted,
		m.ClientRequestsHandled,
	}

	for _, metric := range metrics {
		err := registry.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}

	return nil
}

func NewConnectMetrics() *ConnectMetrics {
	return &ConnectMetrics{
		ServerRequestsStarted: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "connect_server_started_total",
			Help: "Counter of server connect (gRPC/HTTP) requests started",
		}, []string{"package", "call", "call_type"}),
		ServerRequestsHandled: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "connect_server_handled_seconds",
			Help: "Histogram of server connect (gRPC/HTTP) requests completed",
		}, []string{"package", "call", "call_type", "code"}),

		ClientRequestsStarted: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "connect_client_started_total",
			Help: "Counter of client connect (gRPC/HTTP) requests started",
		}, []string{"package", "call", "call_type"}),
		ClientRequestsHandled: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "connect_client_handled_seconds",
			Help: "Histogram of client connect (gRPC/HTTP) requests completed",
		}, []string{"package", "call", "call_type", "code"}),
	}
}

func NewMetricsInterceptor(metrics *ConnectMetrics) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			now := time.Now()
			callPackage, callName := splitServiceCall(req.Spec().Procedure)
			callType := streamType(req.Spec().StreamType)
			isClient := req.Spec().IsClient

			if isClient {
				metrics.ClientRequestsStarted.WithLabelValues(callPackage, callName, callType).Inc()
			} else {
				metrics.ServerRequestsStarted.WithLabelValues(callPackage, callName, callType).Inc()
			}

			resp, err := next(ctx, req)

			code := codeOf(err)
			if isClient {
				metrics.ClientRequestsHandled.WithLabelValues(callPackage, callName, callType, code).Observe(time.Since(now).Seconds())
			} else {
				metrics.ServerRequestsHandled.WithLabelValues(callPackage, callName, callType, code).Observe(time.Since(now).Seconds())
			}

			return resp, err
		})
	}

	return connect.UnaryInterceptorFunc(interceptor)
}

func splitServiceCall(procedure string) (string, string) {
	procedure = strings.TrimPrefix(procedure, "/") // remove leading slash
	if i := strings.Index(procedure, "/"); i >= 0 {
		return procedure[:i], procedure[i+1:]
	}

	return "unknown", "unknown"
}

func streamType(st connect.StreamType) string {
	switch st {
	case connect.StreamTypeUnary:
		return "unary"
	case connect.StreamTypeClient:
		return "client_stream"
	case connect.StreamTypeServer:
		return "server_stream"
	case connect.StreamTypeBidi:
		return "bidi"
	default:
		return "unknown"
	}
}

func codeOf(err error) string {
	if err == nil {
		return "ok"
	}
	return connect.CodeOf(err).String()
}
