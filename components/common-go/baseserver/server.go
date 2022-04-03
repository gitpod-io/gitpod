package baseserver

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"net"
	"net/http"
)

type config struct {
	logger *logrus.Entry

	grpcPort int
	httpPort int

	certs *Certs
}

func defaultConfig() *config {
	return &config{
		logger:   log.New(),
		grpcPort: 9001,
		httpPort: 9000,
		certs:    nil,
	}
}

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

	for serveErr := range errors {
		s.cfg.logger.WithError(err).Errorf("Server failed to serve.")

		// TODO: Shut down both servers

		return fmt.Errorf("server failed: %w", serveErr)
	}

	return nil
}

func (s *Server) Close(ctx context.Context) error {
	if s.listening == nil {
		return fmt.Errorf("server is not running, invalid close operaiton")
	}

	if s.isClosing() {
		return fmt.Errorf("server is alredy closing")
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

func (s *Server) Logger() *logrus.Entry {
	return s.cfg.logger
}

func (s *Server) HTTPAddress() string {
	return s.httpListener.Addr().String()
}

func (s *Server) GRPCAddress() string {
	return s.grpcListener.Addr().String()
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
	s.httpMux = http.NewServeMux()
	s.http = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.cfg.httpPort),
		Handler: s.httpMux,
	}

	return nil
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
