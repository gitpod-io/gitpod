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

func New(name string, opts Opts) *Server {
	logger := log.New()
	server := &Server{
		logger: logger,
	}
	server.opts = opts

	server.Name = name

	server.HTTPMux = http.NewServeMux()
	server.GRPC = grpc.NewServer()
	server.HTTP = &http.Server{
		Addr:    fmt.Sprintf(":%d", opts.HTTPPort),
		Handler: server.HTTPMux,
	}

	return server
}

type Server struct {
	logger *logrus.Entry

	// Name is the name of this server, used for logging context
	Name string

	// HTTP is an HTTP Server
	HTTP         *http.Server
	HTTPMux      *http.ServeMux
	httpListener net.Listener

	// GRPC is a GRPC Server
	GRPC         *grpc.Server
	grpcListener net.Listener

	opts Opts
}

func (s *Server) ListenAndServe() error {
	var err error
	// First, we start the GRPC server
	s.grpcListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.opts.GRPCPort))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", s.opts.GRPCPort)
	}

	s.httpListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.opts.HTTPPort))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", s.opts.GRPCPort)
	}

	errors := make(chan error)

	go func() {
		s.Logger().
			WithField("protocol", "grpc").
			Infof("Serving gRPC on %s", s.grpcListener.Addr().String())
		if serveErr := s.GRPC.Serve(s.grpcListener); serveErr != nil {
			// TODO: Log
			errors <- serveErr
		}
	}()

	go func() {
		s.Logger().
			WithField("protocol", "http").
			Infof("Serving HTTP on %s", s.httpListener.Addr().String())
		if serveErr := s.HTTP.Serve(s.httpListener); serveErr != nil {
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

	s.GRPC.GracefulStop()
	s.Logger().Info("GRPC server terminated.")

	// s.GRPC.GracefulStop() also closes the underlying net.Listener, we just release the reference.
	s.grpcListener = nil

	if err := s.HTTP.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to close HTTP server: %w", err)
	}

	// s.HTTP.Shutdown() also closes the underlying net.Listener, we just release the reference.
	s.httpListener = nil

	return nil
}

func (s *Server) Logger() *logrus.Entry {
	return s.logger
}

func (s *Server) HTTPAddress() string {
	return s.httpListener.Addr().String()
}

func (s *Server) GRPCAddress() string {
	return s.grpcListener.Addr().String()
}

type GRPCOptions struct {
	Port           int
	CACertPath     string
	ServerCertPath string
	ServerKeyPath  string
}
