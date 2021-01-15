// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"context"
	"io"
	"os"
	"os/exec"
	"time"

	"github.com/creack/pty"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	// closeTerminaldefaultGracePeriod is the time terminal
	// processes get between SIGTERM and SIGKILL.
	closeTerminaldefaultGracePeriod = 10 * time.Second
)

// NewMuxTerminalService creates a new terminal service
func NewMuxTerminalService(m *Mux) *MuxTerminalService {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	return &MuxTerminalService{
		Mux:            m,
		DefaultWorkdir: "/workspace",
		DefaultShell:   shell,
		Env:            os.Environ(),
	}
}

// MuxTerminalService implements the terminal service API using a terminal Mux
type MuxTerminalService struct {
	Mux *Mux

	DefaultWorkdir string
	DefaultShell   string
	Env            []string

	tokens map[*Term]string
}

// RegisterGRPC registers a gRPC service
func (srv *MuxTerminalService) RegisterGRPC(s *grpc.Server) {
	api.RegisterTerminalServiceServer(s, srv)
}

// RegisterREST registers a REST service
func (srv *MuxTerminalService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterTerminalServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
}

// Open opens a new terminal running the shell
func (srv *MuxTerminalService) Open(ctx context.Context, req *api.OpenTerminalRequest) (*api.OpenTerminalResponse, error) {
	return srv.OpenWithOptions(ctx, req, TermOptions{
		ReadTimeout: 5 * time.Second,
		Annotations: req.Annotations,
	})
}

// OpenWithOptions opens a new terminal running the shell with given options.
// req.Annotations override options.Annotations.
func (srv *MuxTerminalService) OpenWithOptions(ctx context.Context, req *api.OpenTerminalRequest, options TermOptions) (*api.OpenTerminalResponse, error) {
	cmd := exec.Command(srv.DefaultShell)
	cmd.Dir = srv.DefaultWorkdir
	cmd.Env = append(srv.Env, "TERM=xterm-color")
	for key, value := range req.Env {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	for k, v := range req.Annotations {
		options.Annotations[k] = v
	}
	alias, err := srv.Mux.Start(cmd, options)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	// starterToken is just relevant for the service, hence it's not exposed at the Start() call
	var starterToken string
	term := srv.Mux.terms[alias]
	if term != nil {
		starterToken = term.StarterToken
	}

	return &api.OpenTerminalResponse{
		Alias:        alias,
		StarterToken: starterToken,
	}, nil
}

// Close closes a terminal for the given alias
func (srv *MuxTerminalService) Close(ctx context.Context, req *api.CloseTerminalRequest) (*api.CloseTerminalResponse, error) {
	err := srv.Mux.CloseTerminal(req.Alias, closeTerminaldefaultGracePeriod)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &api.CloseTerminalResponse{}, nil
}

// List lists all open terminals
func (srv *MuxTerminalService) List(ctx context.Context, req *api.ListTerminalsRequest) (*api.ListTerminalsResponse, error) {
	srv.Mux.mu.RLock()
	defer srv.Mux.mu.RUnlock()

	res := make([]*api.ListTerminalsResponse_Terminal, 0, len(srv.Mux.terms))
	for alias, term := range srv.Mux.terms {
		var pid int64
		if term.Command.Process != nil {
			pid = int64(term.Command.Process.Pid)
		}

		res = append(res, &api.ListTerminalsResponse_Terminal{
			Alias:       alias,
			Command:     term.Command.Args,
			Pid:         pid,
			Annotations: term.Annotations,
		})
	}

	return &api.ListTerminalsResponse{
		Terminals: res,
	}, nil
}

// Listen listens to a terminal
func (srv *MuxTerminalService) Listen(req *api.ListenTerminalRequest, resp api.TerminalService_ListenServer) error {
	srv.Mux.mu.RLock()
	term, ok := srv.Mux.terms[req.Alias]
	srv.Mux.mu.RUnlock()
	if !ok {
		return status.Error(codes.NotFound, "terminal not found")
	}
	stdout := term.Stdout.Listen()

	log.WithField("alias", req.Alias).Info("new terminal client")
	defer log.WithField("alias", req.Alias).Info("terminal client left")

	errchan := make(chan error, 1)
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdout.Read(buf)
			if err != nil {
				errchan <- err
				return
			}

			// TODO(cw): find out how to separate stdout/stderr
			err = resp.Send(&api.ListenTerminalResponse{Output: &api.ListenTerminalResponse_Stdout{Stdout: buf[:n]}})
			if err != nil {
				errchan <- err
				return
			}
		}
	}()
	select {
	case err := <-errchan:
		if err == io.EOF {
			// EOF isn't really an error here
			return nil
		}
		return status.Error(codes.Internal, err.Error())
	case <-resp.Context().Done():
		return status.Error(codes.DeadlineExceeded, resp.Context().Err().Error())
	}
}

// Write writes to a terminal
func (srv *MuxTerminalService) Write(ctx context.Context, req *api.WriteTerminalRequest) (*api.WriteTerminalResponse, error) {
	srv.Mux.mu.RLock()
	term, ok := srv.Mux.terms[req.Alias]
	srv.Mux.mu.RUnlock()
	if !ok {
		return nil, status.Error(codes.NotFound, "terminal not found")
	}

	n, err := term.PTY.Write(req.Stdin)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &api.WriteTerminalResponse{BytesWritten: uint32(n)}, nil
}

// SetSize sets the terminal's size
func (srv *MuxTerminalService) SetSize(ctx context.Context, req *api.SetTerminalSizeRequest) (*api.SetTerminalSizeResponse, error) {
	srv.Mux.mu.RLock()
	term, ok := srv.Mux.terms[req.Alias]
	srv.Mux.mu.RUnlock()
	if !ok {
		return nil, status.Error(codes.NotFound, "terminal not found")
	}

	// Setting the size only works with the starter token or when forcing it.
	// This protects us from multiple listener mangling the terminal.
	if !(req.GetForce() || req.GetToken() == term.StarterToken) {
		return nil, status.Error(codes.FailedPrecondition, "wrong token or force not set")
	}

	err := pty.Setsize(term.PTY, &pty.Winsize{
		Cols: uint16(req.Cols),
		Rows: uint16(req.Rows),
		X:    uint16(req.WidthPx),
		Y:    uint16(req.HeightPx),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &api.SetTerminalSizeResponse{}, nil
}
