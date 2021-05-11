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
)

var (
	// ErrNotFound means the terminal was not found
	ErrNotFound = errors.New("not found")
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

	res := &Term{
		PTY:         pty,
		Command:     cmd,
		Stdout:      newBufferedMultiWriter(options.LogToStdout, alias),
		Annotations: options.Annotations,
		title:       options.Title,

		StarterToken: token.String(),

		waitDone: make(chan struct{}),
	}

	rawConn, err := pty.SyscallConn()
	if err != nil {
		return nil, err
	}

	rawConn.Control(func(fileFd uintptr) {
		res.fd = int(fileFd)
	})

	go io.Copy(res.Stdout, pty)
	return res, nil
}

// TermOptions is a pseudo-terminal configuration
type TermOptions struct {
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
	Annotations  map[string]string
	title        string

	Stdout *bufferedMultiWriter

	waitErr  error
	waitDone chan struct{}

	fd int
}

func (term *Term) GetTitle() (string, error) {
	var b bytes.Buffer
	title := term.title
	b.WriteString(title)
	command, err := term.resolveForegroundCommand()
	if title != "" && command != "" {
		b.WriteString(": ")
	}
	b.WriteString(command)
	return b.String(), err
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
	select {
	case <-term.waitDone:
	}
	return term.Command.ProcessState, term.waitErr
}

type bufferedMultiWriter struct {
	closed bool
	mu     sync.RWMutex
	buffer *RingBuffer
	cond   *sync.Cond

	logStdout bool
	logLabel  string
}

func newBufferedMultiWriter(logStdout bool, label string) *bufferedMultiWriter {
	buf, _ := NewRingBuffer(4 * 1024)
	res := &bufferedMultiWriter{
		buffer:    buf,
		logStdout: logStdout,
		logLabel:  label,
	}
	res.cond = sync.NewCond(&res.mu)
	return res
}

func (mw *bufferedMultiWriter) Write(p []byte) (n int, err error) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	n, err = mw.buffer.Write(p)
	if mw.logStdout {
		log.WithFields(logrus.Fields{
			"terminalOutput": true,
			"label":          mw.logLabel,
		}).Info(string(p))
	}

	mw.cond.Broadcast()

	return
}

func (mw *bufferedMultiWriter) Reader() io.Reader {
	if mw.closed {
		return closedListener
	}

	return &bufferedMultiWriterReader{
		p:      mw,
		offset: 0,
	}
}

func (mw *bufferedMultiWriter) Close() error {
	mw.cond.L.Lock()
	defer mw.cond.L.Unlock()

	mw.closed = true
	mw.cond.Broadcast()
	return nil
}

type bufferedMultiWriterReader struct {
	p      *bufferedMultiWriter
	offset int64
}

func (r *bufferedMultiWriterReader) Read(p []byte) (n int, err error) {
	r.p.mu.RLock()
	if r.p.closed {
		r.p.mu.RUnlock()
		return 0, io.EOF
	}
	rn := r.p.buffer.Read(p, r.offset)
	r.p.mu.RUnlock()

	if rn < 0 {
		r.p.cond.L.Lock()
		r.p.cond.Wait()
		closed := r.p.closed
		if !closed {
			rn = r.p.buffer.Read(p, r.offset)
		}
		r.p.cond.L.Unlock()

		if closed {
			return 0, io.EOF
		}
	}
	if rn < 0 {
		return 0, io.EOF
	}
	r.offset += rn
	return int(rn), nil
}

type closedTerminalListener struct {
}

func (closedTerminalListener) Read(p []byte) (n int, err error) {
	return 0, io.EOF
}

var closedListener = io.NopCloser(closedTerminalListener{})
