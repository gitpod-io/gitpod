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

type Opts struct {
	GRPCPort int
	HTTPPort int
}

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
}

func (s *Server) ListenAndServe() error {
	var err error
	// First, we start the grpc server
	s.grpcListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.grpcPort))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", s.opts.GRPCPort)
	}

	s.httpListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.httpPort))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", s.opts.GRPCPort)
	}

	errors := make(chan error)

	go func() {
		s.Logger().
			WithField("protocol", "grpc").
			Infof("Serving gRPC on %s", s.grpcListener.Addr().String())
		if serveErr := s.grpc.Serve(s.grpcListener); serveErr != nil {

			// TODO: Log
			errors <- serveErr
		}
	}()

	go func() {
		s.Logger().
			WithField("protocol", "http").
			Infof("Serving http on %s", s.httpListener.Addr().String())
		if serveErr := s.http.Serve(s.httpListener); serveErr != nil {
			// TODO: Log
			errors <- serveErr
		}
	}()

	fmt.Println("Waiting for errors")
	for serveErr := range errors {
		fmt.Println("errors", serveErr)

		// TODO: Shut down both servers

		return fmt.Errorf("server failed: %w", serveErr)
	}

	return nil
}

func (s *Server) Close(ctx context.Context) error {
	s.Logger().Info("Received graceful shutdown request.")

	s.grpc.GracefulStop()
	s.Logger().Info("grpc server terminated.")

	// s.grpc.GracefulStop() also closes the underlying net.Listener, we just release the reference.
	s.grpcListener = nil

	if err := s.http.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to close http server: %w", err)
	}

	// s.http.Shutdown() also closes the underlying net.Listener, we just release the reference.
	s.httpListener = nil

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
