// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package grpc

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_opentracing "github.com/grpc-ecosystem/go-grpc-middleware/tracing/opentracing"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/keepalive"
)

// maxMsgSize use 16MB as the default message size limit.
// grpc library default is 4MB
const maxMsgSize = 1024 * 1024 * 16

var defaultClientOptionsConfig struct {
	Metrics *grpc_prometheus.ClientMetrics
}

// ClientMetrics produces client-side gRPC metrics
func ClientMetrics() prometheus.Collector {
	res := grpc_prometheus.NewClientMetrics()
	defaultClientOptionsConfig.Metrics = res
	return res
}

// DefaultClientOptions returns the default grpc client connection options
func DefaultClientOptions() []grpc.DialOption {
	bfConf := backoff.DefaultConfig
	bfConf.MaxDelay = 5 * time.Second

	var (
		unaryInterceptor = []grpc.UnaryClientInterceptor{
			grpc_opentracing.UnaryClientInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())),
		}
		streamInterceptor = []grpc.StreamClientInterceptor{
			grpc_opentracing.StreamClientInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())),
		}
	)
	if defaultClientOptionsConfig.Metrics != nil {
		unaryInterceptor = append(unaryInterceptor, defaultClientOptionsConfig.Metrics.UnaryClientInterceptor())
		streamInterceptor = append(streamInterceptor, defaultClientOptionsConfig.Metrics.StreamClientInterceptor())
	}

	res := []grpc.DialOption{
		grpc.WithUnaryInterceptor(grpc_middleware.ChainUnaryClient(unaryInterceptor...)),
		grpc.WithStreamInterceptor(grpc_middleware.ChainStreamClient(streamInterceptor...)),
		grpc.WithBlock(),
		grpc.WithConnectParams(grpc.ConnectParams{
			Backoff: bfConf,
		}),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                10 * time.Second,
			Timeout:             time.Second,
			PermitWithoutStream: true,
		}),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(maxMsgSize)),
	}

	return res
}

// DefaultServerOptions returns the default ServerOption sets options for internal components
func DefaultServerOptions() []grpc.ServerOption {
	return ServerOptionsWithInterceptors([]grpc.StreamServerInterceptor{}, []grpc.UnaryServerInterceptor{})
}

// ServerOptionsWithInterceptors returns the default ServerOption sets options for internal components with additional interceptors.
// By default, Interceptors for OpenTracing (grpc_opentracing) are added as the last one.
func ServerOptionsWithInterceptors(stream []grpc.StreamServerInterceptor, unary []grpc.UnaryServerInterceptor) []grpc.ServerOption {
	stream = append(stream, grpc_opentracing.StreamServerInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())))
	unary = append(unary, grpc_opentracing.UnaryServerInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())))

	return []grpc.ServerOption{
		// terminate the connection if the client pings more than once every 2 seconds
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             10 * time.Second,
			PermitWithoutStream: true,
		}),
		grpc.MaxRecvMsgSize(maxMsgSize),
		// We don't know how good our cients are at closing connections. If they don't close them properly
		// we'll be leaking goroutines left and right. Closing Idle connections should prevent that.
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle: 30 * time.Minute,
		}),
		grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(stream...)),
		grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(unary...)),
	}
}

func SetupLogging() {
	grpclog.SetLoggerV2(grpclog.NewLoggerV2(
		log.WithField("component", "grpc").WriterLevel(logrus.DebugLevel),
		log.WithField("component", "grpc").WriterLevel(logrus.WarnLevel),
		log.WithField("component", "grpc").WriterLevel(logrus.ErrorLevel),
	))
}
