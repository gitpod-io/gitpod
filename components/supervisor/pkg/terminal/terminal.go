// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

// NewMux creates a new terminal mux
func NewMux() *Mux {
	return &Mux{
		terms: make(map[string]*Term),
	}
}

// Mux can mux pseudo-terminals
type Mux struct {
	aliases []string
	terms   map[string]*Term
	mu      sync.RWMutex
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

	pty, err := pty.StartWithSize(cmd, options.Size)
	if err != nil {
		return "", xerrors.Errorf("cannot start PTY: %w", err)
	}

	uid, err := uuid.NewRandom()
	if err != nil {
		return "", xerrors.Errorf("cannot produce alias: %w", err)
	}
	alias = uid.String()

	term, err := newTerm(alias, pty, cmd, options)
	if err != nil {
		pty.Close()
		return "", err
	}
	m.aliases = append(m.aliases, alias)
	m.terms[alias] = term

	log.WithField("alias", alias).WithField("cmd", cmd.Path).Info("started new terminal")

	go func() {
		term.waitErr = cmd.Wait()
		close(term.waitDone)
		_ = m.CloseTerminal(alias, 0*time.Second)
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
		if cerr != nil {
			log.WithError(cerr).WithField("alias", k).Warn("cannot properly close terminal")
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
		return ErrNotFound
	}

	log := log.WithField("alias", alias)
	log.Info("closing terminal")
	err := term.gracefullyShutdownProcess(gracePeriod)
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
	i := 0
	for i < len(m.aliases) && m.aliases[i] != alias {
		i++
	}
	if i != len(m.aliases) {
		m.aliases = append(m.aliases[:i], m.aliases[i+1:]...)
	}
	delete(m.terms, alias)

	return nil
}

func (term *Term) gracefullyShutdownProcess(gracePeriod time.Duration) error {
	if term.Command.Process == nil {
		// process is alrady gone
		return nil
	}
	if gracePeriod == 0 {
		return term.shutdownProcessImmediately()
	}

	err := term.Command.Process.Signal(unix.SIGTERM)
	if err != nil {
		return err
	}
	schan := make(chan error, 1)
	go func() {
		_, err := term.Wait()
		schan <- err
	}()
	select {
	case err = <-schan:
		if err == nil {
			// process is gone now - we're good
			return nil
		}
		log.WithError(err).Warn("unexpected terminal error")
	case <-time.After(gracePeriod):
	}

	// process did not exit in time. Let's kill.
	return term.shutdownProcessImmediately()
}

func (term *Term) shutdownProcessImmediately() error {
	err := term.Command.Process.Kill()
	if err != nil && !strings.Contains(err.Error(), "os: process already finished") {
		return err
	}
	return nil
}

// terminalBacklogSize is the number of bytes of output we'll store in RAM for each terminal.
// The higher this number is, the better the UX, but the higher the resource requirements are.
// For now we assume an average of five terminals per workspace, which makes this consume 1MiB of RAM.
const terminalBacklogSize = 256 << 10

func newTerm(alias string, pty *os.File, cmd *exec.Cmd, options TermOptions) (*Term, error) {
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
			timeout:   timeout,
			listener:  make(map[*multiWriterListener]struct{}),
			recorder:  recorder,
			logStdout: options.LogToStdout,
			logLabel:  alias,
		},
		annotations:  options.Annotations,
		defaultTitle: options.Title,

		StarterToken: token.String(),

		waitDone: make(chan struct{}),
	}
	if res.annotations == nil {
		res.annotations = make(map[string]string)
	}

	rawConn, err := pty.SyscallConn()
	if err != nil {
		return nil, err
	}

	err = rawConn.Control(func(fileFd uintptr) {
		res.fd = int(fileFd)
	})
	if err != nil {
		return nil, err
	}

	//nolint:errcheck
	go io.Copy(res.Stdout, pty)
	return res, nil
}

// TermOptions is a pseudo-terminal configuration
type TermOptions struct {
	// timeout after which a listener is dropped. Use 0 for no timeout.
	ReadTimeout time.Duration

	// Annotations are user-defined metadata that's attached to a terminal
	Annotations map[string]string

	// Size describes the terminal size.
	Size *pty.Winsize

	// Title describes the terminal title.
	Title string

	// LogToStdout forwards the terminal's stdout to supervisor's stdout
	LogToStdout bool
}

// Term is a pseudo-terminal
type Term struct {
	PTY          *os.File
	Command      *exec.Cmd
	StarterToken string

	mu           sync.RWMutex
	annotations  map[string]string
	defaultTitle string
	title        string

	Stdout *multiWriter

	waitErr  error
	waitDone chan struct{}

	fd int
}

func (term *Term) GetTitle() (string, api.TerminalTitleSource, error) {
	term.mu.RLock()
	title := term.title
	term.mu.RUnlock()
	if title != "" {
		return title, api.TerminalTitleSource_api, nil
	}
	var b bytes.Buffer
	defaultTitle := term.defaultTitle
	b.WriteString(defaultTitle)
	command, err := term.resolveForegroundCommand()
	if defaultTitle != "" && command != "" {
		b.WriteString(": ")
	}
	b.WriteString(command)
	return b.String(), api.TerminalTitleSource_process, err
}

func (term *Term) SetTitle(title string) {
	term.mu.Lock()
	defer term.mu.Unlock()
	term.title = title
}

func (term *Term) GetAnnotations() map[string]string {
	term.mu.RLock()
	defer term.mu.RUnlock()
	annotations := make(map[string]string, len(term.annotations))
	for k, v := range term.annotations {
		annotations[k] = v
	}
	return annotations
}

func (term *Term) UpdateAnnotations(changed map[string]string, deleted []string) {
	term.mu.Lock()
	defer term.mu.Unlock()
	for k, v := range changed {
		term.annotations[k] = v
	}
	for _, k := range deleted {
		delete(term.annotations, k)
	}
}

func (term *Term) resolveForegroundCommand() (string, error) {
	pgrp, err := unix.IoctlGetInt(term.fd, unix.TIOCGPGRP)
	if err != nil {
		return "", err
	}
	content, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pgrp))
	if err != nil {
		return "", err
	}
	end := bytes.Index(content, []byte{0})
	if end != -1 {
		content = content[:end]
	}
	start := bytes.LastIndex(content, []byte{os.PathSeparator})
	if start != -1 {
		content = content[(start + 1):]
	}
	return string(content), nil
}

// Wait waits for the terminal to exit and returns the resulted process state
func (term *Term) Wait() (*os.ProcessState, error) {
	<-term.waitDone
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

	logStdout bool
	logLabel  string
}

var (
	// ErrNotFound means the terminal was not found
	ErrNotFound = errors.New("not found")
	// ErrReadTimeout happens when a listener takes too long to read
	ErrReadTimeout = errors.New("read timeout")
)

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

var closedListener = io.NopCloser(closedTerminalListener{})

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
		_, _ = w.Write(recording)

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
				_ = res.CloseWithError(err)
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
	if mw.logStdout {
		log.WithFields(logrus.Fields{
			"terminalOutput": true,
			"label":          mw.logLabel,
		}).Info(string(p))
	}

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
