package terminal

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/google/uuid"
	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type multiWriter struct {
	closed   bool
	mu       sync.Mutex
	listener map[io.WriteCloser]struct{}
}

func (mw *multiWriter) Listen() io.ReadCloser {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	r, w := io.Pipe()
	res := opCloser{
		Reader: r,
		Op: func() error {
			mw.mu.Lock()
			defer mw.mu.Unlock()
			delete(mw.listener, w)
			return nil
		},
	}
	mw.listener[w] = struct{}{}

	return &res
}

type opCloser struct {
	io.Reader
	Op func() error
}

func (c *opCloser) Close() error { return c.Op() }

func (mw *multiWriter) Write(p []byte) (n int, err error) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	for w := range mw.listener {
		n, err = w.Write(p)
		if err != nil {
			return
		}
		if n != len(p) {
			err = io.ErrShortWrite
			return
		}
	}
	return len(p), nil
}

func (mw *multiWriter) Close() error {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	mw.closed = true

	var err error
	for w := range mw.listener {
		cerr := w.Close()
		if cerr != nil {
			err = cerr
		}
	}
	return err
}

func (mw *multiWriter) ListenerCount() int {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	return len(mw.listener)
}

func newTerm(pty *os.File, cmd *exec.Cmd) (*term, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	res := &term{
		PTY:     pty,
		Command: cmd,
		Stdout:  &multiWriter{listener: make(map[io.WriteCloser]struct{})},

		StarterToken: token.String(),
	}
	go io.Copy(res.Stdout, pty)
	return res, nil
}

type term struct {
	PTY          *os.File
	Command      *exec.Cmd
	Title        string
	StarterToken string

	Stdout *multiWriter
}

// NewMux creates a new terminal mux
func NewMux() *Mux {
	return &Mux{
		terms: make(map[string]*term),
	}
}

// Mux can mux pseudo-terminals
type Mux struct {
	terms map[string]*term
	mu    sync.RWMutex
}

// Start starts a new command in its own pseudo-terminal and returns an alias
// for that pseudo terminal.
func (m *Mux) Start(cmd *exec.Cmd) (alias string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	pty, err := pty.Start(cmd)
	if err != nil {
		return "", xerrors.Errorf("cannot start PTY: %w", err)
	}

	uid, err := uuid.NewRandom()
	if err != nil {
		return "", xerrors.Errorf("cannot produce alias: %w", err)
	}
	alias = uid.String()

	term, err := newTerm(pty, cmd)
	if err != nil {
		pty.Close()
		return "", err
	}
	m.terms[alias] = term

	log.WithField("alias", alias).WithField("cmd", cmd.Path).Info("started new terminal")

	go func() {
		cmd.Process.Wait()
		m.Close(alias)
	}()

	return alias, nil
}

// Close closes a terminal and ends the process that runs in it
func (m *Mux) Close(alias string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	term, ok := m.terms[alias]
	if !ok {
		return fmt.Errorf("not found")
	}

	log := log.WithField("alias", alias)
	log.Info("closing terminal")
	if term.Command.ProcessState == nil || !term.Command.ProcessState.Exited() {
		log.WithField("cmd", term.Command.Args).Debug("killing process")
		term.Command.Process.Kill()
	}
	err := term.Stdout.Close()
	if err != nil {
		log.WithError(err).Warn("cannot close connection to terminal clients")
	}
	err = term.PTY.Close()
	if err != nil {
		log.WithError(err).Warn("cannot close pseudo-terminal")
	}

	return nil
}

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

	tokens map[*term]string
}

// RegisterGRPC registers a gRPC service
func (srv *MuxTerminalService) RegisterGRPC(s *grpc.Server) {
	api.RegisterTerminalServiceServer(s, srv)
}

// RegisterREST registers a REST service
func (srv *MuxTerminalService) RegisterREST(mux *runtime.ServeMux) error {
	return nil
}

// Open opens a new terminal running the login shell
func (srv *MuxTerminalService) Open(ctx context.Context, req *api.OpenTerminalRequest) (*api.OpenTerminalResponse, error) {
	cmd := exec.Command(srv.LoginShell[0], srv.LoginShell[1:]...)
	cmd.Dir = srv.DefaultWorkdir
	cmd.Env = append(os.Environ(), "TERM=xterm-color")
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
