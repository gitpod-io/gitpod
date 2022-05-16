// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package loadgen

import (
	"context"
	"fmt"
	"io"
	"math/rand"
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

const loadgenAnnotation = "loadgen"

// WsmanExecutor talks to a ws manager
type WsmanExecutor struct {
	C          api.WorkspaceManagerClient
	Sub        []context.CancelFunc
	workspaces []string
}

// StartWorkspace starts a new workspace
func (w *WsmanExecutor) StartWorkspace(spec *StartWorkspaceSpec) (callDuration time.Duration, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	s := *spec
	s.Metadata.Annotations[loadgenAnnotation] = "true"
	ss := api.StartWorkspaceRequest(s)

	t0 := time.Now()
	_, err = w.C.StartWorkspace(ctx, &ss)
	if err != nil {
		return 0, err
	}

	w.workspaces = append(w.workspaces, ss.Id)
	return time.Since(t0), nil
}

// Observe observes all workspaces started by the excecutor
func (w *WsmanExecutor) Observe() (<-chan WorkspaceUpdate, error) {
	res := make(chan WorkspaceUpdate)

	ctx, cancel := context.WithCancel(context.Background())
	w.Sub = append(w.Sub, cancel)

	sub, err := w.C.Subscribe(ctx, &api.SubscribeRequest{})
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

	log.Info("stopping workspaces")
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

	listReq := api.GetWorkspacesRequest{
		MustMatch: &api.MetadataFilter{
			Annotations: map[string]string{
				loadgenAnnotation: "true",
			},
		},
	}

	for {
		resp, err := w.C.GetWorkspaces(ctx, &listReq)
		if len(resp.Status) == 0 {
			break
		}

		if err != nil {
			log.Warnf("could not get workspaces: %v", err)
		}

		select {
		case <-ctx.Done():
			return fmt.Errorf("not all workspaces could be stopped")
		default:
			time.Sleep(5 * time.Second)
		}
	}

	return nil
}
