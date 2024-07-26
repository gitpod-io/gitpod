// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package terminal

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"

	_pty "github.com/creack/pty"
	"github.com/google/uuid"

	"github.com/sirupsen/logrus"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/process"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

const (
	CBAUD   = 0010017 // CBAUD Serial speed settings
	CBAUDEX = 0010000 // CBAUDX Serial speed settings

	DEFAULT_COLS = 80
	DEFAULT_ROWS = 24
)

// NewMux creates a new terminal mux.
func NewMux() *Mux {
	return &Mux{
		terms: make(map[string]*Term),
	}
}

// Mux can mux pseudo-terminals.
type Mux struct {
	aliases []string
	terms   map[string]*Term
	mu      sync.RWMutex
}

// Get returns a terminal for the given alias.
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

	uid, err := uuid.NewRandom()
	if err != nil {
		return "", xerrors.Errorf("cannot produce alias: %w", err)
	}
	alias = uid.String()

	term, err := newTerm(alias, cmd, options)
	if err != nil {
		return "", err
	}
	m.aliases = append(m.aliases, alias)
	m.terms[alias] = term

	log.WithField("alias", alias).WithField("cmd", cmd.Path).Info("started new terminal")

	go func() {
		term.waitErr = cmd.Wait()
		close(term.waitDone)
		_ = m.CloseTerminal(context.Background(), alias, false)
	}()

	return alias, nil
}

// Close closes all terminals.
// force kills it's processes when the context gets cancelled
func (m *Mux) Close(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	wg := sync.WaitGroup{}
	for alias, term := range m.terms {
		wg.Add(1)
		k := alias
		v := term
		go func() {
			defer wg.Done()
			err := v.Close(ctx)
			if err != nil {
				log.WithError(err).WithField("alias", k).Warn("Error while closing pseudo-terminal")
			}
		}()
	}
	wg.Wait()

	m.aliases = m.aliases[:0]
	for k := range m.terms {
		delete(m.terms, k)
	}
}

// CloseTerminal closes a terminal and ends the process that runs in it.
func (m *Mux) CloseTerminal(ctx context.Context, alias string, forceSuccess bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.doClose(ctx, alias, forceSuccess)
}

// doClose closes a terminal and ends the process that runs in it.
// First, the process receives SIGTERM and is given gracePeriod time
// to stop. If it still runs after that time, it receives SIGKILL.
//
// Callers are expected to hold mu.
func (m *Mux) doClose(ctx context.Context, alias string, forceSuccess bool) error {
	term, ok := m.terms[alias]
	if !ok {
		return ErrNotFound
	}

	log := log.WithField("alias", alias)
	log.Info("closing terminal")

	if forceSuccess {
		term.ForceSuccess = true
	}

	err := term.Close(ctx)
	if err != nil {
		log.WithError(err).Warn("Error while closing pseudo-terminal")
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

// terminalBacklogSize is the number of bytes of output we'll store in RAM for each terminal.
// The higher this number is, the better the UX, but the higher the resource requirements are.
// For now we assume an average of five terminals per workspace, which makes this consume 1MiB of RAM.
const terminalBacklogSize = 256 << 10

func newTerm(alias string, cmd *exec.Cmd, options TermOptions) (*Term, error) {
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
		timeout = NoTimeout
	}

	annotations := options.Annotations
	if annotations == nil {
		annotations = make(map[string]string)
	}

	size := _pty.Winsize{Cols: DEFAULT_COLS, Rows: DEFAULT_ROWS}
	if options.Size != nil {
		if options.Size.Cols != 0 {
			size.Cols = options.Size.Cols
		}
		if options.Size.Rows != 0 {
			size.Rows = options.Size.Rows
		}
	}

	pty, pts, err := _pty.Open()
	if err != nil {
		pts.Close()
		pty.Close()
		return nil, xerrors.Errorf("cannot start PTY: %w", err)
	}

	if err := _pty.Setsize(pty, &size); err != nil {
		pts.Close()
		pty.Close()
		return nil, err
	}

	// Set up terminal (from node-pty)
	var attr unix.Termios
	attr.Iflag = unix.ICRNL | unix.IXON | unix.IXANY | unix.IMAXBEL | unix.BRKINT | syscall.IUTF8
	attr.Oflag = unix.OPOST | unix.ONLCR
	attr.Cflag = unix.CREAD | unix.CS8 | unix.HUPCL
	attr.Lflag = unix.ICANON | unix.ISIG | unix.IEXTEN | unix.ECHO | unix.ECHOE | unix.ECHOK | unix.ECHOKE | unix.ECHOCTL
	attr.Cc[unix.VEOF] = 4
	attr.Cc[unix.VEOL] = 0xff
	attr.Cc[unix.VEOL2] = 0xff
	attr.Cc[unix.VERASE] = 0x7f
	attr.Cc[unix.VWERASE] = 23
	attr.Cc[unix.VKILL] = 21
	attr.Cc[unix.VREPRINT] = 18
	attr.Cc[unix.VINTR] = 3
	attr.Cc[unix.VQUIT] = 0x1c
	attr.Cc[unix.VSUSP] = 26
	attr.Cc[unix.VSTART] = 17
	attr.Cc[unix.VSTOP] = 19
	attr.Cc[unix.VLNEXT] = 22
	attr.Cc[unix.VDISCARD] = 15
	attr.Cc[unix.VMIN] = 1
	attr.Cc[unix.VTIME] = 0

	attr.Ispeed = unix.B38400
	attr.Ospeed = unix.B38400
	attr.Cflag &^= CBAUD | CBAUDEX
	attr.Cflag |= unix.B38400

	err = unix.IoctlSetTermios(int(pts.Fd()), syscall.TCSETS, &attr)
	if err != nil {
		pts.Close()
		pty.Close()
		return nil, err
	}

	cmd.Stdout = pts
	cmd.Stderr = pts
	cmd.Stdin = pts

	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setsid = true
	cmd.SysProcAttr.Setctty = true

	if err := cmd.Start(); err != nil {
		pts.Close()
		pty.Close()
		return nil, err
	}

	res := &Term{
		PTY:     pty,
		pts:     pts,
		Command: cmd,
		Stdout: &multiWriter{
			timeout:   timeout,
			listener:  make(map[*multiWriterListener]struct{}),
			recorder:  recorder,
			logStdout: options.LogToStdout,
			logLabel:  alias,
		},
		annotations:  annotations,
		defaultTitle: options.Title,

		StarterToken: token.String(),

		waitDone: make(chan struct{}),
	}

	//nolint:errcheck
	go io.Copy(res.Stdout, pty)
	return res, nil
}

// NoTimeout means that listener can block read forever
var NoTimeout time.Duration = 1<<63 - 1

// TermOptions is a pseudo-terminal configuration.
type TermOptions struct {
	// timeout after which a listener is dropped. Use 0 for no timeout.
	ReadTimeout time.Duration

	// Annotations are user-defined metadata that's attached to a terminal
	Annotations map[string]string

	// Size describes the terminal size.
	Size *_pty.Winsize

	// Title describes the terminal title.
	Title string

	// LogToStdout forwards the terminal's stdout to supervisor's stdout
	LogToStdout bool
}

// Term is a pseudo-terminal.
type Term struct {
	PTY *os.File
	pts *os.File

	Command      *exec.Cmd
	StarterToken string

	mu     sync.RWMutex
	closed bool

	annotations  map[string]string
	defaultTitle string
	title        string

	// ForceSuccess overrides the process' exit code to 0
	ForceSuccess bool

	Stdout *multiWriter

	waitErr  error
	waitDone chan struct{}
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
	pgrp, err := unix.IoctlGetInt(int(term.PTY.Fd()), unix.TIOCGPGRP)
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

// Wait waits for the terminal to exit and returns the resulted process state.
func (term *Term) Wait() (*os.ProcessState, error) {
	<-term.waitDone
	return term.Command.ProcessState, term.waitErr
}

func (term *Term) Close(ctx context.Context) error {
	term.mu.Lock()
	defer term.mu.Unlock()

	if term.closed {
		return nil
	}

	term.closed = true

	var commandErr error
	if term.Command.Process != nil {
		commandErr = process.TerminateSync(ctx, term.Command.Process.Pid)
		if process.IsNotChildProcess(commandErr) {
			commandErr = nil
		}
	}

	writeErr := term.Stdout.Close()

	slaveErr := errors.New("Slave FD nil")
	if term.pts != nil {
		slaveErr = term.pts.Close()
	}
	masterErr := errors.New("Master FD nil")
	if term.PTY != nil {
		masterErr = term.PTY.Close()
	}

	var errs []string
	if commandErr != nil {
		errs = append(errs, "Process: cannot terminate process: "+commandErr.Error())
	}
	if writeErr != nil {
		errs = append(errs, "Multiwriter: "+writeErr.Error())
	}
	if slaveErr != nil {
		errs = append(errs, "Slave: "+slaveErr.Error())
	}
	if masterErr != nil {
		errs = append(errs, "Master: "+masterErr.Error())
	}

	if len(errs) > 0 {
		return errors.New(strings.Join(errs, " "))
	}

	return nil
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
	// ErrNotFound means the terminal was not found.
	ErrNotFound = errors.New("not found")
	// ErrReadTimeout happens when a listener takes too long to read.
	ErrReadTimeout = errors.New("read timeout")
)

type multiWriterListener struct {
	io.Reader
	timeout time.Duration

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
		l.closed = true
		close(l.closeChan)

		// actual cleanup happens in a go routine started by Listen()
	})
	return nil
}

func (l *multiWriterListener) Done() <-chan struct{} {
	return l.closeChan
}

type closedTerminalListener struct{}

func (closedTerminalListener) Read(p []byte) (n int, err error) {
	return 0, io.EOF
}

var closedListener = io.NopCloser(closedTerminalListener{})

// TermListenOptions is a configuration to listen to the pseudo-terminal .
type TermListenOptions struct {
	// timeout after which a listener is dropped. Use 0 for default timeout.
	ReadTimeout time.Duration
}

// Listen listens in on the multi-writer stream.
func (mw *multiWriter) Listen() io.ReadCloser {
	return mw.ListenWithOptions(TermListenOptions{
		ReadTimeout: 0,
	})
}

// Listen listens in on the multi-writer stream with given options.
func (mw *multiWriter) ListenWithOptions(options TermListenOptions) io.ReadCloser {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	if mw.closed {
		return closedListener
	}

	timeout := options.ReadTimeout
	if timeout == 0 {
		timeout = mw.timeout
	}
	r, w := io.Pipe()
	cchan, done, closeChan := make(chan []byte), make(chan struct{}, 1), make(chan struct{}, 1)
	res := &multiWriterListener{
		Reader:    r,
		cchan:     cchan,
		done:      done,
		closeChan: closeChan,
		timeout:   timeout,
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

		mw.mu.Lock()
		defer mw.mu.Unlock()
		close(cchan)

		delete(mw.listener, res)
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
		case <-time.After(lstr.timeout):
			lstr.CloseWithError(ErrReadTimeout)
		}

		select {
		case <-lstr.done:
		case <-time.After(lstr.timeout):
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
