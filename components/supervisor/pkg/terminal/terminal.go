package terminal

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

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
	delete(m.terms, alias)

	return nil
}

func newTerm(pty *os.File, cmd *exec.Cmd) (*term, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	res := &term{
		PTY:     pty,
		Command: cmd,
		Stdout:  &multiWriter{listener: make(map[*multiWriterListener]struct{})},

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

// multiWriter is like io.MultiWriter, except that we can listener at runtime.
type multiWriter struct {
	closed   bool
	mu       sync.Mutex
	listener map[*multiWriterListener]struct{}
}

type multiWriterListener struct {
	io.Reader

	closed    bool
	once      sync.Once
	closeChan chan struct{}
	cchan     chan []byte
}

func (l *multiWriterListener) Close() error {
	l.once.Do(func() {
		close(l.closeChan)
		l.closed = true

		// actual cleanup happens in a go routine started by Listen()
	})
	return nil
}

func (l *multiWriterListener) Done() <-chan struct{} {
	return l.closeChan
}

// Listen listens in on the multi-writer stream
func (mw *multiWriter) Listen() *multiWriterListener {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	r, w := io.Pipe()
	cchan, closeChan := make(chan []byte), make(chan struct{}, 1)
	res := &multiWriterListener{
		Reader:    r,
		cchan:     cchan,
		closeChan: closeChan,
	}

	go func() {
		// copy bytes from channel to writer.
		// Note: we close the writer independently of the write operation s.t. we don't
		//       block the closing because the write's blocking.
		for b := range cchan {
			_, err := w.Write(b)
			if err != nil {
				log.WithError(err).Error("terminal listener droped out")
				res.Close()
			}
		}
	}()
	go func() {
		// listener cleanup on close
		<-closeChan
		w.Close()
		close(cchan)

		mw.mu.Lock()
		delete(mw.listener, res)
		mw.mu.Unlock()
	}()

	mw.listener[res] = struct{}{}

	return res
}

func (mw *multiWriter) Write(p []byte) (n int, err error) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	for lstr := range mw.listener {
		if lstr.closed {
			continue
		}

		select {
		case lstr.cchan <- p:
		case <-time.After(5 * time.Second):
			lstr.Close()
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

type opCloser struct {
	io.Reader
	Op func() error
}

func (c *opCloser) Close() error { return c.Op() }
