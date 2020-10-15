// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"context"
	"io"
	"os"
	"os/exec"

	"github.com/creack/pty"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// NewMuxTerminalService creates a new terminal service
func NewMuxTerminalService(m *Mux) *MuxTerminalService {
	return &MuxTerminalService{
		Mux:            m,
		DefaultWorkdir: "/workspace",
		LoginShell:     []string{"/bin/bash", "-i", "-l"},
	}
}

// MuxTerminalService implements the terminal service API using a terminal Mux
type MuxTerminalService struct {
	Mux *Mux

	DefaultWorkdir string
	LoginShell     []string

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

// Open opens a new terminal running the login shell
func (srv *MuxTerminalService) Open(ctx context.Context, req *api.OpenTerminalRequest) (*api.OpenTerminalResponse, error) {
	cmd := exec.Command(srv.LoginShell[0], srv.LoginShell[1:]...)
	cmd.Dir = srv.DefaultWorkdir
	cmd.Env = append(os.Environ(), "TERM=xterm-color")
	for key, value := range req.Env {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	alias, err := srv.Mux.Start(cmd)
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
	err := srv.Mux.Close(req.Alias)
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
		res = append(res, &api.ListTerminalsResponse_Terminal{
			Alias:   alias,
			Command: term.Command.Args,
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
