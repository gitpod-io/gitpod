// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package loadgen

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"os"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// Executor starts and watches workspaces
type Executor interface {
	// StartWorkspace starts a new workspace
	StartWorkspace(spec *StartWorkspaceSpec) (callDuration time.Duration, err error)

	// Observe observes all workspaces started by the excecutor
	Observe() (<-chan WorkspaceUpdate, error)

	// StopAll stops all workspaces started by the executor
	StopAll(ctx context.Context) error

	// Dump dumps the executor state to a file
	Dump(path string) error
}

// StartWorkspaceSpec specifies a workspace
type StartWorkspaceSpec api.StartWorkspaceRequest

// WorkspaceUpdate describes a workspace state
type WorkspaceUpdate struct {
	OwnerID     string `json:"owner"`
	WorkspaceID string `json:"workspace"`
	InstanceID  string `json:"instance"`

	Phase  api.WorkspacePhase `json:"phase"`
	Failed bool               `json:"failed"`
}

// NewFakeExecutor creates a new fake executor
func NewFakeExecutor() *FakeExecutor {
	return &FakeExecutor{
		updates: make(chan WorkspaceUpdate),
		stop:    make(chan struct{}),
	}
}

// FakeExecutor creates fake workspaces
type FakeExecutor struct {
	updates chan WorkspaceUpdate
	stop    chan struct{}
}

// StartWorkspace starts a new workspace
func (fe *FakeExecutor) StartWorkspace(spec *StartWorkspaceSpec) (callDuration time.Duration, err error) {
	log.WithField("spec", spec).Info("StartWorkspace")
	go fe.produceUpdates(spec)
	callDuration = time.Duration(rand.Uint32()%5000) * time.Millisecond
	return
}

func (fe *FakeExecutor) produceUpdates(spec *StartWorkspaceSpec) {
	u := WorkspaceUpdate{
		InstanceID:  spec.Id,
		WorkspaceID: spec.Metadata.MetaId,
		OwnerID:     spec.Metadata.Owner,
		Phase:       api.WorkspacePhase_PENDING,
	}
	fe.updates <- u

	for _, p := range []api.WorkspacePhase{
		api.WorkspacePhase_PENDING,
		api.WorkspacePhase_CREATING,
		api.WorkspacePhase_INITIALIZING,
		api.WorkspacePhase_RUNNING,
	} {
		time.Sleep(time.Duration(rand.Uint32()%2000) * time.Millisecond)
		u.Phase = p
		select {
		case fe.updates <- u:
		case <-fe.stop:
			return
		}
	}
}

// Observe observes all workspaces started by the excecutor
func (fe *FakeExecutor) Observe() (<-chan WorkspaceUpdate, error) {
	return fe.updates, nil
}

// StopAll stops all workspaces started by the executor
func (fe *FakeExecutor) StopAll() error {
	close(fe.stop)
	return nil
}

const (
	loadgenAnnotation = "loadgen"
	// loadgenSessionAnnotation is used to identify which loadgen session
	// a workspace belongs to. Allows for running multiple loadgens in parallel.
	loadgenSessionAnnotation = "loadgen-session-id"
)

// WsmanExecutor talks to a ws manager
type WsmanExecutor struct {
	C          api.WorkspaceManagerClient
	Sub        []context.CancelFunc
	SessionId  string
	workspaces []string
	mu         sync.Mutex
}

// StartWorkspace starts a new workspace
func (w *WsmanExecutor) StartWorkspace(spec *StartWorkspaceSpec) (callDuration time.Duration, err error) {
	// Make the start workspace timeout same as the ws-manager start workspace timeout
	// https://github.com/gitpod-io/gitpod/blob/f0d464788dbf1ec9495b0802849c95ff86500c98/components/ws-manager/pkg/manager/manager.go#L182
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	s := *spec
	if s.Metadata.Annotations == nil {
		s.Metadata.Annotations = make(map[string]string)
	}
	s.Metadata.Annotations[loadgenAnnotation] = "true"
	s.Metadata.Annotations[loadgenSessionAnnotation] = w.SessionId
	ss := api.StartWorkspaceRequest(s)

	t0 := time.Now()
	_, err = w.C.StartWorkspace(ctx, &ss)
	if err != nil {
		return 0, err
	}

	// Must lock as StartWorkspace is called from multiple goroutines.
	w.mu.Lock()
	w.workspaces = append(w.workspaces, ss.Id)
	w.mu.Unlock()
	return time.Since(t0), nil
}

// Observe observes all workspaces started by the excecutor
func (w *WsmanExecutor) Observe() (<-chan WorkspaceUpdate, error) {
	res := make(chan WorkspaceUpdate)

	ctx, cancel := context.WithCancel(context.Background())
	w.Sub = append(w.Sub, cancel)

	sub, err := w.C.Subscribe(ctx, &api.SubscribeRequest{
		MustMatch: w.loadgenSessionFilter(),
	})
	if err != nil {
		return nil, err
	}
	go func() {
		defer close(res)
		for {
			resp, err := sub.Recv()
			if err != nil {
				if err != io.EOF && status.Code(err) != codes.Canceled {
					log.WithError(err).Warn("subscription failure")
				}
				return
			}
			status := resp.GetStatus()
			if status == nil {
				continue
			}

			res <- WorkspaceUpdate{
				InstanceID:  status.Id,
				WorkspaceID: status.Metadata.MetaId,
				OwnerID:     status.Metadata.Owner,
				Failed:      status.Conditions.Failed != "",
				Phase:       status.Phase,
			}
		}
	}()
	return res, nil
}

// StopAll stops all workspaces started by the executor
func (w *WsmanExecutor) StopAll(ctx context.Context) error {
	for _, s := range w.Sub {
		s()
	}

	listReq := api.GetWorkspacesRequest{
		MustMatch: w.loadgenSessionFilter(),
	}

	log.Infof("stopping %d workspaces", len(w.workspaces))
	start := time.Now()
	for _, id := range w.workspaces {
		stopReq := api.StopWorkspaceRequest{
			Id:     id,
			Policy: api.StopWorkspacePolicy_NORMALLY,
		}

		_, err := w.C.StopWorkspace(ctx, &stopReq)
		if err != nil {
			log.Warnf("failed to stop %s", id)
		}
	}

	w.workspaces = make([]string, 0)

	for {
		resp, err := w.C.GetWorkspaces(ctx, &listReq)
		if err != nil {
			log.Warnf("could not get workspaces: %v", err)
		} else {
			if len(resp.GetStatus()) == 0 {
				break
			}
		}

		select {
		case <-ctx.Done():
			elapsed := time.Since(start)
			return fmt.Errorf("not all workspaces could be stopped: %s", elapsed)
		default:
			time.Sleep(5 * time.Second)
		}
	}

	elapsed := time.Since(start)
	log.Infof("Time taken to stop workspaces: %s", elapsed)

	return nil
}

func (w *WsmanExecutor) Dump(path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	listReq := api.GetWorkspacesRequest{
		MustMatch: w.loadgenSessionFilter(),
	}

	resp, err := w.C.GetWorkspaces(ctx, &listReq)
	if err != nil {
		return err
	}

	var wss []WorkspaceState
	for _, status := range resp.GetStatus() {
		ws := WorkspaceState{
			WorkspaceName: status.Metadata.MetaId,
			InstanceId:    status.Id,
			Phase:         status.Phase,
			Class:         status.Spec.Class,
			NodeName:      status.Runtime.NodeName,
			Pod:           status.Runtime.PodName,
			Context:       status.Metadata.Annotations["context-url"],
		}

		wss = append(wss, ws)
	}

	fc, err := json.MarshalIndent(wss, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, fc, 0644)
}

func (w *WsmanExecutor) loadgenSessionFilter() *api.MetadataFilter {
	return &api.MetadataFilter{
		Annotations: map[string]string{
			loadgenAnnotation:        "true",
			loadgenSessionAnnotation: w.SessionId,
		},
	}
}

type WorkspaceState struct {
	WorkspaceName string
	InstanceId    string
	Phase         api.WorkspacePhase
	Class         string
	NodeName      string
	Pod           string
	Context       string
}
