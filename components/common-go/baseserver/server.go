// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
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
	var err error
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

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)

	// Await operating system signals, or server errors.
	select {
	case sig := <-signals:
		s.Logger().Infof("Received system signal %s, closing server.", sig.String())
		if closeErr := s.Close(); closeErr != nil {
			s.Logger().WithError(closeErr).Error("Failed to close server.")
			return closeErr
		}

		return nil
	case serverErr := <-errors:
		s.Logger().WithError(serverErr).Errorf("Server encountered an error. Closing remaining servers.")
		if closeErr := s.Close(); closeErr != nil {
			return fmt.Errorf("failed to close server after one of the servers errored: %w", closeErr)
		}

		return serverErr
	}
}

func (s *Server) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.closeTimeout)
	defer cancel()

	return s.close(ctx)
}

func (s *Server) Logger() *logrus.Entry {
	return s.cfg.logger
}

func (s *Server) HTTPAddress() string {
	protocol := "http"
	return fmt.Sprintf("%s://%s:%d", protocol, s.cfg.hostname, s.cfg.httpPort)
}

func (s *Server) GRPCAddress() string {
	protocol := "http"
	return fmt.Sprintf("%s://%s:%d", protocol, s.cfg.hostname, s.cfg.grpcPort)
}

func (s *Server) HTTPMux() *http.ServeMux {
	return s.httpMux
}

func (s *Server) close(ctx context.Context) error {
	if s.listening == nil {
		return fmt.Errorf("server is not running, invalid close operation")
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
	// TODO(milan): Use a ready/health package already used in ws-manager
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`ready`))
	})

	return mux
}

func (s *Server) initializeGRPC() error {
	s.grpc = grpc.NewServer()

	return nil
}
