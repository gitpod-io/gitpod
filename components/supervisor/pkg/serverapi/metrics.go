// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package serverapi

import (
	"context"
	"errors"
	"time"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sourcegraph/jsonrpc2"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	ServerTypePublicAPI = "public-api"
)

type ClientMetrics struct {
	clientHandledCounter   *prometheus.CounterVec
	clientHandledHistogram *prometheus.HistogramVec
}

func NewClientMetrics() *ClientMetrics {
	return &ClientMetrics{
		clientHandledCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "supervisor_client_handled_total",
				Help: "Total number of supervisor outgoing services completed by the client, regardless of success or failure.",
				// add server label to identify it's going for server api or public api
			}, []string{"method", "server", "err_code"}),
		clientHandledHistogram: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "supervisor_client_handling_seconds",
				Help: "Histogram of response latency (seconds) of the supervisor outgoing services until it is finished by the application.",
				// it should be aligned with https://github.com/gitpod-io/gitpod/blob/84ed1a0672d91446ba33cb7b504cfada769271a8/install/installer/pkg/components/ide-metrics/configmap.go#L315
				Buckets: []float64{0.1, 0.2, 0.5, 1, 2, 5, 10},
			}, []string{"method", "server", "err_code"}),
	}
}

func (c *ClientMetrics) ProcessMetrics(method string, err error, startTime time.Time) {
	code := status.Code(normalizeError(err))
	server := ServerTypePublicAPI
	c.clientHandledCounter.WithLabelValues(method, server, code.String()).Inc()
	c.clientHandledHistogram.WithLabelValues(method, server, code.String()).Observe(time.Since(startTime).Seconds())
}

// guard to make sure ClientMetrics implement Collector interface
var _ prometheus.Collector = (*ClientMetrics)(nil)

func (c *ClientMetrics) Collect(ch chan<- prometheus.Metric) {
	c.clientHandledCounter.Collect(ch)
	c.clientHandledHistogram.Collect(ch)
}

func (c *ClientMetrics) Describe(ch chan<- *prometheus.Desc) {
	c.clientHandledCounter.Describe(ch)
	c.clientHandledHistogram.Describe(ch)
}

func normalizeError(err error) error {
	if err == nil {
		return nil
	}

	if errors.Is(err, context.Canceled) {
		return status.Error(codes.Canceled, context.Canceled.Error())
	}

	if rpcErr := new(jsonrpc2.Error); errors.As(err, &rpcErr) {
		switch rpcErr.Code {
		case 400:
			return status.Error(codes.InvalidArgument, rpcErr.Message)
		case 401:
			return status.Error(codes.Unauthenticated, rpcErr.Message)
		case 403:
			return status.Error(codes.PermissionDenied, rpcErr.Message)
		case 404:
			return status.Error(codes.NotFound, rpcErr.Message)
		case 409:
			return status.Error(codes.AlreadyExists, rpcErr.Message)
		case -32603:
			return status.Error(codes.Internal, rpcErr.Message)
		case 470:
			return status.Error(codes.PermissionDenied, rpcErr.Message)

		default:
			return status.Error(codes.Internal, rpcErr.Message)
		}
	}

	if handshakeErr := new(protocol.ErrBadHandshake); errors.As(err, &handshakeErr) {
		return status.Error(codes.Unauthenticated, "Failed to establish caller identity")
	}

	return err
}
