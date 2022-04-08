// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"net"
	"net/http"
	"time"
)

type config struct {
	logger *logrus.Entry

	// ctx is the lifetime context of the server
	ctx context.Context

	hostname string
	grpcPort int
	httpPort int

	certs *Certs
}

func defaultConfig() *config {
	return &config{
		logger:   log.New(),
		ctx:      context.Background(),
		hostname: "localhost",
		grpcPort: 9001,
		httpPort: 9000,
		certs:    nil,
	}
}

const (
	defaultCloseTimeout = 3 * time.Second
)

func New(name string, opts ...Option) (*Server, error) {
	cfg, err := evaluateOptions(defaultConfig(), opts...)
	if err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	server := &Server{
		Name: name,
		cfg:  cfg,
	}

	if initErr := server.initializeHTTP(); initErr != nil {
		return nil, fmt.Errorf("failed to initialize http server: %w", initErr)
	}
	if initErr := server.initializeGRPC(); initErr != nil {
		return nil, fmt.Errorf("failed to initialize grpc server: %w", initErr)
	}

	return server, nil
}

type Server struct {
	// Name is the name of this server, used for logging context
	Name string

	cfg *config

	// http is an http Server
	http         *http.Server
	httpMux      *http.ServeMux
	httpListener net.Listener

	// grpc is a grpc Server
	grpc         *grpc.Server
	grpcListener net.Listener

	// listening indicates the server is serving. When closed, the server is in the process of graceful termination.
	listening chan struct{}
}

func (s *Server) ListenAndServe() error {
	ctx := s.Context()
	var err error
	// First, we start the grpc server
	s.grpcListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.grpcPort))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", s.cfg.grpcPort)
	}

	s.httpListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.httpPort))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", s.cfg.grpcPort)
	}

	errors := make(chan error)
	defer close(errors)
	s.listening = make(chan struct{})

	go func() {
		s.Logger().
			WithField("protocol", "grpc").
			Infof("Serving gRPC on %s", s.grpcListener.Addr().String())
		if serveErr := s.grpc.Serve(s.grpcListener); serveErr != nil {
			if s.isClosing() {
				return
			}

			errors <- serveErr
		}
	}()

	go func() {
		s.Logger().
			WithField("protocol", "http").
			Infof("Serving http on %s", s.httpListener.Addr().String())
		if serveErr := s.http.Serve(s.httpListener); serveErr != nil {
			if s.isClosing() {
				return
			}

			errors <- serveErr
		}
	}()

	// Await cancellation, or server errors.
	select {
	case <-ctx.Done():
		s.Logger().WithError(ctx.Err()).Info("Server context cancelled, shutting down servers.")
		if closeErr := s.Close(); closeErr != nil {
			return fmt.Errorf("failed to close server after server context was cancelled: %w", closeErr)
		}
		return nil

	case serverErr := <-errors:
		s.cfg.logger.WithError(serverErr).Errorf("Server failed.")
		if closeErr := s.Close(); closeErr != nil {
			return fmt.Errorf("failed to close server after one of the servers errored: %w", closeErr)
		}

		return nil
	}
}

func (s *Server) Close() error {
	return s.CloseWithin(defaultCloseTimeout)
}

func (s *Server) CloseWithContext(ctx context.Context) error {
	return s.close(ctx)
}

func (s *Server) CloseWithin(t time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), t)
	defer cancel()

	return s.close(ctx)
}

func (s *Server) Logger() *logrus.Entry {
	return s.cfg.logger
}

func (s *Server) Context() context.Context {
	return s.cfg.ctx
}

func (s *Server) HTTPAddress() string {
	protocol := "http"
	if s.cfg.certs != nil {
		protocol = "https"
	}

	return fmt.Sprintf("%s://%s:%d", protocol, s.cfg.hostname, s.cfg.httpPort)
}

func (s *Server) GRPCAddress() string {
	protocol := "http"
	if s.cfg.certs != nil {
		protocol = "https"
	}

	return fmt.Sprintf("%s://%s:%d", protocol, s.cfg.hostname, s.cfg.grpcPort)
}

func (s *Server) close(ctx context.Context) error {
	if s.listening == nil {
		return fmt.Errorf("server is not running, invalid close operaiton")
	}

	if s.isClosing() {
		s.Logger().Info("Server is already closing.")
		return nil
	}

	s.Logger().Info("Received graceful shutdown request.")
	close(s.listening)

	s.grpc.GracefulStop()
	// s.grpc.GracefulStop() also closes the underlying net.Listener, we just release the reference.
	s.grpcListener = nil
	s.Logger().Info("GRPC server terminated.")

	if err := s.http.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to close http server: %w", err)
	}
	// s.http.Shutdown() also closes the underlying net.Listener, we just release the reference.
	s.httpListener = nil
	s.Logger().Info("HTTP server terminated.")

	return nil
}

func (s *Server) isClosing() bool {
	select {
	case <-s.listening:
		// listening channel is closed, we're in graceful shutdown mode
		return true
	default:
		return false
	}
}

func (s *Server) initializeHTTP() error {
	s.httpMux = s.newHTTPMux()
	s.http = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.cfg.httpPort),
		Handler: s.httpMux,
	}

	return nil
}

func (s *Server) newHTTPMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("/ready", ReadyHandler())
	mux.Handle("/metrics", promhttp.Handler())

	return mux
}

func (s *Server) initializeGRPC() error {
	s.grpc = grpc.NewServer()

	return nil
}

type Certs struct {
	CACertPath     string
	ServerCertPath string
	ServerKeyPath  string
}

func (s *Server) WaitForServerToBeReachable(timeout time.Duration) bool {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	tick := 100 * time.Millisecond
	t := time.NewTicker(tick)
	defer t.Stop()

	client := http.Client{
		Timeout: tick,
	}

	healthURL := fmt.Sprintf("%s/ready", s.HTTPAddress())

	for {
		select {
		case <-ctx.Done():
			return false
		case <-t.C:
			_, err := client.Get(healthURL)
			if err != nil {
				continue
			}

			// any response means we've managed to reach the server
			return true
		}
	}
}
