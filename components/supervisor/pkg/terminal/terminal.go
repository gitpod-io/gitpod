// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"errors"
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
		terms: make(map[string]*Term),
	}
}

// Mux can mux pseudo-terminals
type Mux struct {
	terms map[string]*Term
	mu    sync.RWMutex
}

// Get returns a terminal for the given alias
func (m *Mux) Get(alias string) (*Term, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	term, ok := m.terms[alias]
	return term, ok
}

// Start starts a new command in its own pseudo-terminal and returns an alias
// for that pseudo terminal.
func (m *Mux) Start(cmd *exec.Cmd, options TermOptions) (alias string, err error) {
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

	term, err := newTerm(pty, cmd, options)
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

// terminalBacklogSize is the number of bytes of output we'll store in RAM for each terminal.
// The higher this number is, the better the UX, but the higher the resource requirements are.
// For now we assume an average of five terminals per workspace, which makes this consume 1MiB of RAM.
const terminalBacklogSize = 256 << 10

func newTerm(pty *os.File, cmd *exec.Cmd, options TermOptions) (*Term, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	recorder, err := NewRingBuffer(terminalBacklogSize)
	if err != nil {
		return nil, err
	}

	timeout := options.ReadTimeout
	if timeout == 0 {
		timeout = 1<<63 - 1
	}
	res := &Term{
		PTY:     pty,
		Command: cmd,
		Stdout: &multiWriter{
			timeout:  timeout,
			listener: make(map[*multiWriterListener]struct{}),
			recorder: recorder,
		},

		StarterToken: token.String(),
	}
	go io.Copy(res.Stdout, pty)
	return res, nil
}

// TermOptions is a pseudo-terminal configuration
type TermOptions struct {
	// timeout after which a listener is dropped. Use 0 for no timeout.
	ReadTimeout time.Duration
}

// Term is a pseudo-terminal
type Term struct {
	PTY          *os.File
	Command      *exec.Cmd
	Title        string
	StarterToken string

	Stdout *multiWriter
}

// multiWriter is like io.MultiWriter, except that we can listener at runtime.
type multiWriter struct {
	timeout  time.Duration
	closed   bool
	mu       sync.RWMutex
	listener map[*multiWriterListener]struct{}
	// ring buffer to record last 256kb of pty output
	// new listener is initialized with the latest recodring first
	recorder *RingBuffer
}

// ErrReadTimeout happens when a listener takes too long to read
var ErrReadTimeout = errors.New("read timeout")

type multiWriterListener struct {
	io.Reader

	closed    bool
	once      sync.Once
	closeErr  error
	closeChan chan struct{}
	cchan     chan []byte
	done      chan struct{}
}

func (l *multiWriterListener) Close(err error) error {
	l.once.Do(func() {
		if err != nil {
			l.closeErr = err
		}
		close(l.closeChan)
		l.closed = true

		// actual cleanup happens in a go routine started by Listen()
	})
	return nil
}

func (l *multiWriterListener) Done() <-chan struct{} {
	return l.closeChan
}

type closedTerminalListener struct {
}

func (closedTerminalListener) Read(p []byte) (n int, err error) {
	return 0, errors.New("terminal is closed")
}

var closedListener = closedTerminalListener{}

// Listen listens in on the multi-writer stream
func (mw *multiWriter) Listen() io.Reader {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	if mw.closed {
		return closedListener
	}

	r, w := io.Pipe()
	cchan, done, closeChan := make(chan []byte), make(chan struct{}, 1), make(chan struct{}, 1)
	res := &multiWriterListener{
		Reader:    r,
		cchan:     cchan,
		done:      done,
		closeChan: closeChan,
	}

	recording := mw.recorder.Bytes()
	go func() {
		w.Write(recording)

		// copy bytes from channel to writer.
		// Note: we close the writer independently of the write operation s.t. we don't
		//       block the closing because the write's blocking.
		for b := range cchan {
			n, err := w.Write(b)
			done <- struct{}{}
			if err == nil && n != len(b) {
				err = io.ErrShortWrite
			}
			if err != nil {
				res.Close(err)
			}
		}
	}()
	go func() {
		// listener cleanup on close
		<-closeChan
		if res.closeErr != nil {
			log.WithError(res.closeErr).Error("terminal listener droped out")
			w.CloseWithError(res.closeErr)
		} else {
			w.Close()
		}
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

	mw.recorder.Write(p)

	for lstr := range mw.listener {
		if lstr.closed {
			continue
		}

		select {
		case lstr.cchan <- p:
		case <-time.After(mw.timeout):
			lstr.Close(ErrReadTimeout)
		}

		select {
		case <-lstr.done:
		case <-time.After(mw.timeout):
			lstr.Close(ErrReadTimeout)
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
		cerr := w.Close(nil)
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
