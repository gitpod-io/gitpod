// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func newDummyCloser(r io.Reader) io.ReadCloser {
	return &dummyRC{
		Reader: r,
	}
}

type dummyRC struct {
	io.Reader

	Closed bool
}

func (r *dummyRC) Close() error {
	r.Closed = true
	return nil
}

func TestHeadlessLogFirstAttempt(t *testing.T) {
	shouldFailErr := fmt.Errorf("stream provider fail")

	cases := []struct {
		Name              string
		StreamProviderErr error
		ExpectedErr       error
	}{
		{"should-fail", shouldFailErr, shouldFailErr},
		{"should-succeed", nil, nil},
	}

	for _, c := range cases {
		mgr := forTestingOnlyGetManager(t)
		listener := NewHeadlessListener(mgr.RawClient, "")
		listener.listenerTimeout = 100 * time.Millisecond
		listener.logStreamProvider = func(pod *corev1.Pod, container string, from time.Time) (io.ReadCloser, error) {
			if c.StreamProviderErr != nil {
				return nil, c.StreamProviderErr
			}

			return newDummyCloser(bytes.NewReader([]byte{})), nil
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		err := listener.Listen(ctx, &corev1.Pod{
			Status: corev1.PodStatus{
				StartTime: &metav1.Time{Time: time.Now()},
			},
		})
		if err != c.ExpectedErr {
			t.Errorf("expected error when establishing listener: expected %v, got %v", c.ExpectedErr, err)
		}
	}
}

func newSegmentedStream(segments []string) *segmentedStream {
	return &segmentedStream{
		Segments: segments,
		Seg:      -1,
		Done:     make(chan struct{}),
		OnEvt:    func(block, closed bool) {},
		c:        make(chan struct{}),
	}
}

// segmentedStream simulates the kubernetes behaviour where the log output suddenly stops until we reconnect
type segmentedStream struct {
	Segments []string
	Seg      int
	Done     chan struct{}
	OnEvt    func(block, closed bool)

	mu sync.Mutex
	r  io.Reader
	c  chan struct{}
}

func (s *segmentedStream) Read(b []byte) (n int, err error) {
	s.mu.Lock()

	if s.Seg < 0 {
		s.mu.Unlock()
		return 0, fmt.Errorf("missing call to Advance()")
	}
	if s.Seg >= len(s.Segments) {
		s.mu.Unlock()
		return 0, io.EOF
	}

	if s.r == nil {
		s.r = bytes.NewReader([]byte(s.Segments[s.Seg]))
	}

	n, err = s.r.Read(b)
	s.mu.Unlock()

	if err == io.EOF {
		if n == 0 {
			// wait for closure
			s.OnEvt(true, false)
			<-s.c
		}

		// reset io error to simulate blocking k8s
		err = nil
	}

	return
}

func (s *segmentedStream) Close() error {
	s.mu.Lock()
	if s.r == nil {
		s.mu.Unlock()
		return fmt.Errorf("not open")
	}
	s.mu.Unlock()

	s.c <- struct{}{}
	s.OnEvt(false, true)
	return nil
}

func (s *segmentedStream) Advance() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Seg >= len(s.Segments) {
		return
	}

	s.r = nil
	s.Seg++

	if s.Seg >= len(s.Segments) {
		close(s.Done)
	}
}

func TestHeadlessLogTimeout(t *testing.T) {
	t.Skipf("skipping flaky log timeout test")

	mgr := forTestingOnlyGetManager(t)
	listener := NewHeadlessListener(mgr.RawClient, "")
	listener.listenerTimeout = 100 * time.Millisecond

	t0, err := time.Parse(time.RFC3339Nano, "2009-11-10T23:00:00Z")
	if err != nil {
		t.Errorf("invalid test fixture: %v", err)
		return
	}

	segs := make([]string, 2)
	t1 := t0
	for si := range segs {
		var seg string

		if si > 0 {
			// to test if the log listener rejects old messages we prepent some of the previous segment to this one
			origin := strings.Split(segs[si-1], "\n")
			for li := len(origin) / 2; li < len(origin); li++ {
				seg += origin[li] + "\n"
			}
		}

		for li := 0; li < 10; li++ {
			t1 = t1.Add(50 * time.Millisecond)
			seg += fmt.Sprintf("%s seg:%d line:%d\n", t1.Format(time.RFC3339Nano), si, li)
		}
		segs[si] = seg
	}

	type PType struct {
		Blocked   bool
		Closed    bool
		NewStream bool
		Line      bool
	}
	type P struct {
		Type PType
		Line string
	}
	var (
		p  []P
		pm sync.Mutex
	)

	in := newSegmentedStream(segs)
	in.OnEvt = func(blocked, closed bool) {
		pm.Lock()
		p = append(p, P{Type: PType{Blocked: blocked, Closed: closed}})
		pm.Unlock()
	}
	listener.logStreamProvider = func(pod *corev1.Pod, container string, from time.Time) (io.ReadCloser, error) {
		pm.Lock()
		p = append(p, P{Type: PType{NewStream: true}})
		pm.Unlock()

		in.Advance()
		return in, nil
	}
	listener.LogLineHandler = func(pod *corev1.Pod, line string) (continueListening bool) {
		pm.Lock()
		p = append(p, P{Type: PType{Line: true}, Line: line})
		pm.Unlock()
		return true
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	err = listener.Listen(ctx, &corev1.Pod{
		Status: corev1.PodStatus{
			StartTime: &metav1.Time{Time: t0},
		},
	})
	if err != nil {
		t.Errorf("cannot start listening to pod: %v", err)
		return
	}

	select {
	case <-in.Done:
	case <-time.After(5 * time.Second):
		t.Errorf("timeout")
		return
	}

	// verify protocol
	if len(p) == 0 {
		t.Errorf("missing test protocol")
		return
	}

	pi := 0
	if !p[pi].Type.NewStream {
		t.Errorf("logStreamProvider isn't asked for a new stream")
	}
	pi++
	for li := 0; li < 10; li++ {
		exp := fmt.Sprintf("seg:0 line:%d", li)
		if !p[pi].Type.Line || p[pi].Line != exp {
			t.Errorf("line mismatch: expected line == \"%s\" in %+v", exp, p[pi])
		}
		pi++
	}
	if !p[pi].Type.Blocked {
		t.Errorf("segmentedReader did not block when it should have")
	}
	pi++

	// once blocked we expect that the stream be closed and a new opened (in no particular order)
	var closed, opened bool
	for i := 0; i < 2; i++ {
		closed = closed || p[pi].Type.Closed
		opened = opened || p[pi].Type.NewStream
		pi++
	}
	if !closed {
		t.Errorf("headless listener did not close old stream")
	}
	if !opened {
		t.Errorf("logStreamProvider wasn't asked for a new stream")
	}

	for li := 0; li < 10; li++ {
		// we only expect seg1 lines as the seg0 lines (although emitted by our mock reader) are too old
		// at this point.
		exp := fmt.Sprintf("seg:1 line:%d", li)

		if p[pi].Type.Blocked {
			// we have a stray block in here because we have no control over the read behaviour of the scanner.
			// ignore the block
			li--
		} else if !p[pi].Type.Line || p[pi].Line != exp {
			t.Errorf("line mismatch: expected line == \"%s\" in %+v", exp, p[pi])
		}
		pi++
	}
}

type blockingReader struct {
	Closer chan struct{}
}

func (r *blockingReader) Read(b []byte) (n int, err error) {
	<-r.Closer
	return 0, io.EOF
}

func (r *blockingReader) Close() error {
	close(r.Closer)
	return nil
}

func TestHeadlessLogTotalTimeout(t *testing.T) {
	mgr := forTestingOnlyGetManager(t)
	listener := NewHeadlessListener(mgr.RawClient, "")
	listener.listenerTimeout = 1 * time.Millisecond

	var (
		mu   sync.Mutex
		lsc  int
		done = make(chan struct{})
	)
	listener.logStreamProvider = func(pod *corev1.Pod, container string, from time.Time) (io.ReadCloser, error) {
		mu.Lock()
		lsc++
		if lsc >= listenerAttempts {
			close(done)
		}
		mu.Unlock()

		return &blockingReader{make(chan struct{})}, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	err := listener.Listen(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Annotations: map[string]string{
				workspaceIDAnnotation: "TestHeadlessLogTotalTimeout",
			},
		},
		Status: corev1.PodStatus{
			StartTime: &metav1.Time{Time: time.Now()},
		},
	})
	if err != nil {
		t.Errorf("cannot establish initial listener: %v", err)
	}

	select {
	case <-time.After(15 * time.Second):
		t.Errorf("timeout. logStreamProvider call count: %d", lsc)
	case <-done:
	}
}
