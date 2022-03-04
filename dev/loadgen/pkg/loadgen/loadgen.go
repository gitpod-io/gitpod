// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package loadgen

import (
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
)

// Session is a load testing session
type Session struct {
	Executor     Executor
	Load         LoadGenerator
	Specs        WorkspaceGenerator
	Observer     []chan<- *SessionEvent
	PostLoadWait func()

	Worker int
}

// SessionEvent provides updates whenever something happens in this session
type SessionEvent struct {
	Kind SessionEventKind

	Error           error
	WorkspaceStart  *SessionEventWorkspaceStart
	WorkspaceUpdate *SessionEventWorkspaceUpdate
}

// SessionEventKind describes the type of session event
type SessionEventKind int

const (
	// SessionStart means the session started
	SessionStart SessionEventKind = iota
	// SessionError indicates an error. Expect the Error field to non-nil.
	SessionError
	// SessionWorkspaceStart indicates a workspace started. Expect the WorkspaceStart field to be non-nil
	SessionWorkspaceStart
	// SessionWorkspaceUpdate indicates a workspace update. Expect the WorkspaceUpdate field to be non-nil
	SessionWorkspaceUpdate
	// SessionDone indicates the session is done. Expect no more updates.
	SessionDone
)

// SessionEventWorkspaceStart describes a workspace start event
type SessionEventWorkspaceStart struct {
	Time         time.Time
	CallDuration time.Duration
	Spec         *StartWorkspaceSpec
}

// SessionEventWorkspaceUpdate describes a workspace start event
type SessionEventWorkspaceUpdate struct {
	Time   time.Time
	Update WorkspaceUpdate
}

// Run starts the load testing
func (s *Session) Run() error {
	load := s.Load.Generate()

	var infraWG sync.WaitGroup
	infraWG.Add(1)
	updates := make(chan *SessionEvent)
	go s.distributeUpdates(&infraWG, updates)

	start := make(chan struct{})

	obs, err := s.Executor.Observe()
	if err != nil {
		return err
	}
	infraWG.Add(1)
	go func() {
		defer close(updates)
		defer infraWG.Done()

		<-start
		for u := range obs {
			updates <- &SessionEvent{
				Kind: SessionWorkspaceUpdate,
				WorkspaceUpdate: &SessionEventWorkspaceUpdate{
					Time:   time.Now(),
					Update: u,
				},
			}
		}
	}()

	var loadWG sync.WaitGroup
	loadWG.Add(s.Worker)
	for i := 0; i < s.Worker; i++ {
		go func(idx int) {
			defer loadWG.Done()
			log.WithField("worker", idx).Info("load worker started")

			<-start
			for range load {
				spec, err := s.Specs.Generate()
				if err != nil {
					updates <- &SessionEvent{Kind: SessionError, Error: err}
					continue
				}

				dur, err := s.Executor.StartWorkspace(spec)
				if err != nil {
					updates <- &SessionEvent{Kind: SessionError, Error: err}
					continue
				}

				updates <- &SessionEvent{
					Kind: SessionWorkspaceStart,
					WorkspaceStart: &SessionEventWorkspaceStart{
						Time:         time.Now(),
						CallDuration: dur,
						Spec:         spec,
					},
				}
			}
		}(i)
	}

	updates <- &SessionEvent{Kind: SessionStart}
	close(start)

	loadWG.Wait()
	if s.PostLoadWait != nil {
		s.PostLoadWait()
	}
	updates <- &SessionEvent{Kind: SessionDone}
	err = s.Executor.StopAll()
	if err != nil {
		return err
	}

	infraWG.Wait()
	return nil
}

func (s *Session) distributeUpdates(wg *sync.WaitGroup, updates <-chan *SessionEvent) {
	defer wg.Done()

	for u := range updates {
		for _, d := range s.Observer {
			d <- u
		}
	}
	for _, d := range s.Observer {
		close(d)
	}
}
