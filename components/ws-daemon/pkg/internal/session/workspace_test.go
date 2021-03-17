// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package session

import (
	"context"
	"math/rand"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/sirupsen/logrus"
)

func init() {
	logrus.SetLevel(logrus.WarnLevel)
}

func getTestStore() (*Store, error) {
	loc, err := os.MkdirTemp("", "wsdaemon-test")
	if err != nil {
		return nil, err
	}

	return NewStore(context.Background(), loc, nil)
}

func addRandomWorkspace(s *Store) (*Workspace, error) {
	var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
	randString := func(n int) string {
		b := make([]rune, n)
		for i := range b {
			b[i] = letterRunes[rand.Intn(len(letterRunes))]
		}
		return string(b)
	}

	var (
		instanceID  = randString(16)
		owner       = randString(16)
		workspaceID = randString(16)
	)
	factory := func(ctx context.Context, loc string) (*Workspace, error) {
		return &Workspace{
			Location:         loc,
			CheckoutLocation: randString(16),
			CreatedAt:        time.Now(),
			Owner:            owner,
			WorkspaceID:      workspaceID,
			InstanceID:       instanceID,
		}, nil
	}

	location := filepath.Join(s.Location, instanceID)
	return s.NewWorkspace(context.Background(), instanceID, location, factory)
}

func TestPersistAndLoadWorkspace(t *testing.T) {
	store, err := getTestStore()
	if err != nil {
		t.Errorf("cannot create test store: %v", err)
		return
	}

	var hookFired bool
	store.hooks = map[WorkspaceState][]WorkspaceLivecycleHook{
		WorkspaceReady: {
			func(ctx context.Context, ws *Workspace) error {
				hookFired = true
				return nil
			},
		},
	}

	originalWS, err := addRandomWorkspace(store)
	if err != nil {
		t.Errorf("cannot create test workspace: %v", err)
		return
	}

	err = originalWS.MarkInitDone(context.Background())
	if err != nil {
		t.Errorf("cannot mark workspace as init done: %v", err)
		return
	}

	workspaces, err := filepath.Glob(filepath.Join(store.Location, "*.workspace.json"))
	if err != nil {
		t.Errorf("cannot glob workspaces: %v", err)
		return
	}
	if len(workspaces) != 1 {
		t.Errorf("found more than one workspace in our test store")
		return
	}

	reloadedWS, err := loadWorkspace(context.Background(), workspaces[0])
	if err != nil {
		t.Errorf("cannot load workspace %s: %v", workspaces[0], err)
		return
	}

	if diff := cmp.Diff(originalWS, reloadedWS, cmpopts.IgnoreUnexported(Workspace{})); diff != "" {
		t.Errorf("unexpected workspace change (-want +got):\n%s", diff)
	}

	if !hookFired {
		t.Errorf("hook did not fire")
	}
}

func TestWaitForInit(t *testing.T) {
	tests := []struct {
		Desc        string
		State       WorkspaceState
		MarkInit    bool
		ExpectReady bool
	}{
		{"regular init", WorkspaceInitializing, true, true},
		{"ready", WorkspaceReady, false, true},
		{"init again", WorkspaceReady, false, true},
		{"disposing", WorkspaceDisposing, false, false},
		{"init while disposing", WorkspaceDisposing, true, false},
		{"disposed", WorkspaceDisposed, false, false},
		{"init while disposed", WorkspaceDisposed, true, false},
	}

	store, err := getTestStore()
	if err != nil {
		t.Errorf("cannot create test store: %v", err)
		return
	}
	for _, test := range tests {
		ws, err := addRandomWorkspace(store)
		if err != nil {
			t.Errorf("%s: cannot create test workspace: %v", test.Desc, err)
			continue
		}
		ws.state = test.State

		waitStarted := make(chan struct{})
		waitComplete := make(chan struct{})
		markInitComplete := make(chan struct{})
		go func() {
			waitStarted <- struct{}{}
			ready := ws.WaitForInit(context.Background())
			if ready != test.ExpectReady {
				t.Errorf("%s: WaitForInit returned ready == %v, expected %v", test.Desc, ready, test.ExpectReady)
			}
			waitComplete <- struct{}{}
		}()
		go func() {
			<-waitStarted
			if !test.MarkInit {
				markInitComplete <- struct{}{}
				return
			}

			<-time.After(500 * time.Millisecond) // just for good measure

			err := ws.MarkInitDone(context.Background())
			if err != nil {
				t.Errorf("%s: MarkInitDone returned an error: %v", test.Desc, err)
			}
			markInitComplete <- struct{}{}
		}()

		select {
		case <-waitComplete:
		// all is well
		case <-time.After(1 * time.Second):
			t.Errorf("%s: WaitForInit did not complete", test.Desc)
		}
		select {
		case <-markInitComplete:
		// all is well
		case <-time.After(1 * time.Second):
			t.Errorf("%s: MarkInitDone did not complete", test.Desc)
		}
	}
}

func TestWaitOrMarkForDisposalRace(t *testing.T) {
	store, err := getTestStore()
	if err != nil {
		t.Errorf("cannot create test store: %v", err)
		return
	}
	ws, err := addRandomWorkspace(store)
	if err != nil {
		t.Errorf("cannot create test workspace: %v", err)
		return
	}
	ws.state = WorkspaceReady

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var (
		c  int32
		wg sync.WaitGroup
	)
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			done, _, err := ws.WaitOrMarkForDisposal(ctx)
			if err != nil {
				t.Errorf("WaitOrMarkForDisposal failed: %w", err)
			}
			if !done {
				atomic.AddInt32(&c, 1)

				time.Sleep(1 * time.Second)
				t.Logf("num go routines: %03d", runtime.NumGoroutine())
				ws.Dispose(ctx)
			}
		}()
	}
	wg.Wait()

	switch c {
	case 0:
		t.Errorf("WaitOrMarkForDisposal never returned !done: count = %d", c)
	case 1:
		// all is well
	default:
		t.Errorf("WaitOrMarkForDisposal was racey: count = %d", c)
	}
}

func TestWaitOrMarkForDisposal(t *testing.T) {
	tests := []struct {
		Desc        string
		State       WorkspaceState
		Dispose     bool
		ExpectDone1 bool
		ExpectDone2 bool
	}{
		{"regular dispose", WorkspaceReady, true, false, true},
		{"disposed", WorkspaceDisposed, false, true, true},
		{"dispose again", WorkspaceDisposed, false, true, true},
		{"dispose while initializing", WorkspaceInitializing, true, false, true},
	}

	store, err := getTestStore()
	if err != nil {
		t.Errorf("cannot create test store: %v", err)
		return
	}
	for _, test := range tests {
		ws, err := addRandomWorkspace(store)
		if err != nil {
			t.Errorf("%s: cannot create test workspace: %v", test.Desc, err)
			continue
		}
		ws.state = test.State

		waitStarted := make(chan struct{})
		waitComplete := make(chan struct{})
		disposeComplete := make(chan struct{})
		go func() {
			waitStarted <- struct{}{}
			done, _, err := ws.WaitOrMarkForDisposal(context.Background())
			if err != nil {
				t.Errorf("%s: WaitOrMarkForDisposal (1st) returned an error: %v", test.Desc, err)
			}
			if done != test.ExpectDone1 {
				t.Errorf("%s: WaitOrMarkForDisposal (1st) returned done == %v, expected %v", test.Desc, done, test.ExpectDone1)
			}

			done, _, err = ws.WaitOrMarkForDisposal(context.Background())
			if err != nil {
				t.Errorf("%s: WaitOrMarkForDisposal (2nd) returned an error: %v", test.Desc, err)
			}
			if done != test.ExpectDone2 {
				t.Errorf("%s: WaitOrMarkForDisposal (2nd) returned done == %v, expected %v", test.Desc, done, test.ExpectDone2)
			}
			waitComplete <- struct{}{}
		}()
		go func() {
			<-waitStarted
			if !test.Dispose {
				disposeComplete <- struct{}{}
				return
			}

			<-time.After(500 * time.Millisecond) // just for good measure

			err := ws.Dispose(context.Background())
			if err != nil {
				t.Errorf("%s: Dispose returned an error: %v", test.Desc, err)
			}
			disposeComplete <- struct{}{}
		}()

		select {
		case <-waitComplete:
		// all is well
		case <-time.After(1 * time.Second):
			t.Errorf("%s: WaitForInit did not complete", test.Desc)
		}
		select {
		case <-disposeComplete:
		// all is well
		case <-time.After(1 * time.Second):
			t.Errorf("%s: disposeComplete did not complete", test.Desc)
		}
	}
}
