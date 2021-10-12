// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package grpc

import (
	"crypto/tls"
	"crypto/x509"
	"os"
	"path/filepath"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_opentracing "github.com/grpc-ecosystem/go-grpc-middleware/tracing/opentracing"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
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
			Time:                5 * time.Second,
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
			MinTime:             2 * time.Second,
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
		log.WithField("component", "grpc").WriterLevel(logrus.InfoLevel),
		log.WithField("component", "grpc").WriterLevel(logrus.WarnLevel),
		log.WithField("component", "grpc").WriterLevel(logrus.ErrorLevel),
	))
}

// TLSConfigOption configures a TLSConfig
type TLSConfigOption func(*tlsConfigOptions) error

type tlsConfigOptions struct {
	ClientAuth tls.ClientAuthType
	ServerName string

	RootCAs   bool
	ClientCAs bool
}

// WithClientAuth configures a policy for TLS Client Authentication
func WithClientAuth(authType tls.ClientAuthType) TLSConfigOption {
	return func(ico *tlsConfigOptions) error {
		ico.ClientAuth = authType
		return nil
	}
}

// WithServerName configures thge ServerName used to verify the hostname
func WithServerName(serverName string) TLSConfigOption {
	return func(ico *tlsConfigOptions) error {
		ico.ServerName = serverName
		return nil
	}
}

func WithSetRootCAs(rootCAs bool) TLSConfigOption {
	return func(ico *tlsConfigOptions) error {
		ico.RootCAs = rootCAs
		return nil
	}
}

func WithSetClientCAs(clientCAs bool) TLSConfigOption {
	return func(ico *tlsConfigOptions) error {
		ico.ClientCAs = clientCAs
		return nil
	}
}

func ClientAuthTLSConfig(authority, certificate, privateKey string, opts ...TLSConfigOption) (*tls.Config, error) {
	// Telepresence (used for debugging only) requires special paths to load files from
	if root := os.Getenv("TELEPRESENCE_ROOT"); root != "" {
		authority = filepath.Join(root, authority)
		certificate = filepath.Join(root, certificate)
		privateKey = filepath.Join(root, privateKey)
	}

	// Load certs
	tlsCertificate, err := tls.LoadX509KeyPair(certificate, privateKey)
	if err != nil {
		return nil, xerrors.Errorf("cannot load TLS certificate: %w", err)
	}

	// Create a certificate pool from the certificate authority
	certPool := x509.NewCertPool()
	ca, err := os.ReadFile(authority)
	if err != nil {
		return nil, xerrors.Errorf("cannot not read ca certificate: %w", err)
	}

	if ok := certPool.AppendCertsFromPEM(ca); !ok {
		return nil, xerrors.Errorf("failed to append ca certs")
	}

	options := tlsConfigOptions{}
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			return nil, err
		}
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{tlsCertificate},
		CipherSuites: []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		},
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
		MinVersion:       tls.VersionTLS12,
		MaxVersion:       tls.VersionTLS12,
		NextProtos:       []string{"h2"},
	}

	tlsConfig.ServerName = options.ServerName

	if options.ClientAuth != tls.NoClientCert {
		log.WithField("clientAuth", options.ClientAuth).Info("enabling client authentication")
		tlsConfig.ClientAuth = options.ClientAuth
	}

	if options.ClientCAs {
		tlsConfig.ClientCAs = certPool
	}

	if options.RootCAs {
		tlsConfig.RootCAs = certPool
	}

	return tlsConfig, nil
}
