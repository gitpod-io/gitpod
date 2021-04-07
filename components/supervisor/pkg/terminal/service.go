// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/creack/pty"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
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

	api.UnimplementedTerminalServiceServer
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
	shell := req.Shell
	if shell == "" {
		shell = srv.DefaultShell
	}
	cmd := exec.Command(shell, req.ShellArgs...)
	if req.Workdir == "" {
		cmd.Dir = srv.DefaultWorkdir
	} else {
		cmd.Dir = req.Workdir
	}
	cmd.Env = append(srv.Env, "TERM=xterm-color")
	for key, value := range req.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%v=%v", key, value))
	}
	for k, v := range req.Annotations {
		options.Annotations[k] = v
	}
	if req.Size != nil {
		options.Size = &pty.Winsize{
			Cols: uint16(req.Size.Cols),
			Rows: uint16(req.Size.Rows),
			X:    uint16(req.Size.WidthPx),
			Y:    uint16(req.Size.HeightPx),
		}
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

	terminal, found := srv.get(alias)
	if !found {
		return nil, status.Error(codes.NotFound, "terminal not found")
	}
	return &api.OpenTerminalResponse{
		Terminal:     terminal,
		StarterToken: starterToken,
	}, nil
}

// Close closes a terminal for the given alias
func (srv *MuxTerminalService) Shutdown(ctx context.Context, req *api.ShutdownTerminalRequest) (*api.ShutdownTerminalResponse, error) {
	err := srv.Mux.CloseTerminal(req.Alias, closeTerminaldefaultGracePeriod)
	if err == ErrNotFound {
		return nil, status.Error(codes.NotFound, err.Error())
	}
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &api.ShutdownTerminalResponse{}, nil
}

// List lists all open terminals
func (srv *MuxTerminalService) List(ctx context.Context, req *api.ListTerminalsRequest) (*api.ListTerminalsResponse, error) {
	srv.Mux.mu.RLock()
	defer srv.Mux.mu.RUnlock()

	res := make([]*api.Terminal, 0, len(srv.Mux.terms))
	for _, alias := range srv.Mux.aliases {
		term, ok := srv.get(alias)
		if !ok {
			continue
		}
		res = append(res, term)
	}

	return &api.ListTerminalsResponse{
		Terminals: res,
	}, nil
}

// Get returns an open terminal info
func (srv *MuxTerminalService) Get(ctx context.Context, req *api.GetTerminalRequest) (*api.Terminal, error) {
	srv.Mux.mu.RLock()
	defer srv.Mux.mu.RUnlock()
	term, ok := srv.get(req.Alias)
	if !ok {
		return nil, status.Error(codes.NotFound, "terminal not found")
	}
	return term, nil
}

func (srv *MuxTerminalService) get(alias string) (*api.Terminal, bool) {
	term, ok := srv.Mux.terms[alias]
	if !ok {
		return nil, false
	}

	var (
		pid int64
		cwd string
		err error
	)
	if proc := term.Command.Process; proc != nil {
		pid = int64(proc.Pid)
		cwd, err = filepath.EvalSymlinks(fmt.Sprintf("/proc/%d/cwd", pid))
		if err != nil {
			log.WithError(err).WithField("pid", pid).Warn("unable to resolve terminal's current working dir")
			cwd = term.Command.Dir
		}
	}

	title, err := term.GetTitle()
	if err != nil {
		log.WithError(err).WithField("pid", pid).Warn("unable to resolve terminal's title")
	}

	return &api.Terminal{
		Alias:          alias,
		Command:        term.Command.Args,
		Pid:            pid,
		InitialWorkdir: term.Command.Dir,
		CurrentWorkdir: cwd,
		Annotations:    term.Annotations,
		Title:          title,
	}, true
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
	defer stdout.Close()

	log.WithField("alias", req.Alias).Info("new terminal client")
	defer log.WithField("alias", req.Alias).Info("terminal client left")

	errchan := make(chan error, 1)
	messages := make(chan *api.ListenTerminalResponse, 1)
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdout.Read(buf)
			if err == io.EOF {
				break
			}
			if err != nil {
				errchan <- err
				return
			}
			messages <- &api.ListenTerminalResponse{Output: &api.ListenTerminalResponse_Data{Data: buf[:n]}}
		}

		state, err := term.Wait()
		if err != nil {
			errchan <- err
			return
		}

		messages <- &api.ListenTerminalResponse{Output: &api.ListenTerminalResponse_ExitCode{ExitCode: int32(state.ExitCode())}}
		errchan <- io.EOF
	}()
	go func() {
		title, _ := term.GetTitle()
		messages <- &api.ListenTerminalResponse{Output: &api.ListenTerminalResponse_Title{Title: title}}

		t := time.NewTicker(200 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-resp.Context().Done():
				return
			case <-t.C:
				newTitle, _ := term.GetTitle()
				if title == newTitle {
					continue
				}
				title = newTitle
				messages <- &api.ListenTerminalResponse{Output: &api.ListenTerminalResponse_Title{Title: title}}
			}
		}
	}()
	for {
		var err error
		select {
		case message := <-messages:
			err = resp.Send(message)
		case err = <-errchan:
		case <-resp.Context().Done():
			return status.Error(codes.DeadlineExceeded, resp.Context().Err().Error())
		}
		if err == io.EOF {
			// EOF isn't really an error here
			return nil
		}
		if err != nil {
			return status.Error(codes.Internal, err.Error())
		}
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
		Cols: uint16(req.Size.Cols),
		Rows: uint16(req.Size.Rows),
		X:    uint16(req.Size.WidthPx),
		Y:    uint16(req.Size.HeightPx),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &api.SetTerminalSizeResponse{}, nil
}
