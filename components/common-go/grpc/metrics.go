// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package grpc

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// NewUnaryCallMetricsInterceptor creates a new unary interceptor that provides call counts
// and error rate metrics.
func NewUnaryCallMetricsInterceptor(reg prometheus.Registerer) (grpc.UnaryServerInterceptor, error) {
	const (
		labelMethod = "method"
		labelCode   = "code"
	)
	callCountVec := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grpc_call_total",
		Help: "total call per function",
	}, []string{labelMethod})
	err := reg.Register(callCountVec)
	if err != nil {
		return nil, err
	}
	errorCountVec := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grpc_error_total",
		Help: "total error responses per function",
	}, []string{labelMethod, labelCode})
	err = reg.Register(callCountVec)
	if err != nil {
		return nil, err
	}

	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
		callCountVec.With(prometheus.Labels{labelMethod: info.FullMethod}).Inc()

		resp, err = handler(ctx, req)

		if s, ok := status.FromError(err); ok && s.Code() != codes.OK {
			errorCountVec.With(prometheus.Labels{labelMethod: info.FullMethod, labelCode: s.Code().String()}).Inc()
		}
		return
	}, nil
}
