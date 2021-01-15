// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/google/uuid"
	"golang.org/x/sys/unix"
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
		term.waitErr = cmd.Wait()
		close(term.waitDone)
		m.CloseTerminal(alias, 0*time.Second)
	}()

	return alias, nil
}

// Close closes all terminals with closeTerminaldefaultGracePeriod.
func (m *Mux) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var err error
	for k := range m.terms {
		cerr := m.doClose(k, closeTerminaldefaultGracePeriod)
		if cerr == nil {
			log.WithError(err).WithField("alias", k).Warn("cannot properly close terminal")
			if err != nil {
				err = cerr
			}
		}
	}
	return err
}

// CloseTerminal closes a terminal and ends the process that runs in it
func (m *Mux) CloseTerminal(alias string, gracePeriod time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.doClose(alias, gracePeriod)
}

// doClose closes a terminal and ends the process that runs in it.
// First, the process receives SIGTERM and is given gracePeriod time
// to stop. If it still runs after that time, it receives SIGKILL.
//
// Callers are expected to hold mu.
func (m *Mux) doClose(alias string, gracePeriod time.Duration) error {
	term, ok := m.terms[alias]
	if !ok {
		return fmt.Errorf("not found")
	}

	log := log.WithField("alias", alias)
	log.Info("closing terminal")
	err := gracefullyShutdownProcess(term.Command.Process, gracePeriod)
	if err != nil {
		log.WithError(err).Warn("did not gracefully shut down terminal")
	}
	err = term.Stdout.Close()
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

func gracefullyShutdownProcess(p *os.Process, gracePeriod time.Duration) error {
	if p == nil {
		// process is alrady gone
		return nil
	}
	if gracePeriod == 0 {
		return p.Kill()
	}

	err := p.Signal(unix.SIGINT)
	if err != nil {
		return err
	}
	schan := make(chan error)
	go func() {
		_, err := p.Wait()
		schan <- err
	}()
	select {
	case err = <-schan:
		if err == nil {
			// process is gone now - we're good
			return nil
		}
	case <-time.After(gracePeriod):
	}

	// process did not exit in time. Let's kill.
	return p.Kill()
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
		Annotations: options.Annotations,

		StarterToken: token.String(),

		waitDone: make(chan struct{}),
	}
	go io.Copy(res.Stdout, pty)
	return res, nil
}

// TermOptions is a pseudo-terminal configuration
type TermOptions struct {
	// timeout after which a listener is dropped. Use 0 for no timeout.
	ReadTimeout time.Duration

	// Annotations are user-defined metadata that's attached to a terminal
	Annotations map[string]string
}

// Term is a pseudo-terminal
type Term struct {
	PTY          *os.File
	Command      *exec.Cmd
	Title        string
	StarterToken string
	Annotations  map[string]string

	Stdout *multiWriter

	waitErr  error
	waitDone chan struct{}
}

// Wait waits for the terminal to exit and returns the resulted process state
func (term *Term) Wait() (*os.ProcessState, error) {
	select {
	case <-term.waitDone:
	}
	return term.Command.ProcessState, term.waitErr
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

func (l *multiWriterListener) Close() error {
	return l.CloseWithError(nil)
}

func (l *multiWriterListener) CloseWithError(err error) error {
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
	return 0, io.EOF
}

var closedListener = ioutil.NopCloser(closedTerminalListener{})

// Listen listens in on the multi-writer stream
func (mw *multiWriter) Listen() io.ReadCloser {
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
				res.CloseWithError(err)
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
			lstr.CloseWithError(ErrReadTimeout)
		}

		select {
		case <-lstr.done:
		case <-time.After(mw.timeout):
			lstr.CloseWithError(ErrReadTimeout)
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
