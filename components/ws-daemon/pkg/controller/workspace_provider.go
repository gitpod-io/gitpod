// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
)

type WorkspaceFactory func(ctx context.Context, instanceID string) (ws *session.Workspace, err error)

type WorkspaceProvider struct {
	Location   string
	hooks      map[session.WorkspaceState][]session.WorkspaceLivecycleHook
	workspaces sync.Map
}

func NewWorkspaceProvider(location string, hooks map[session.WorkspaceState][]session.WorkspaceLivecycleHook) *WorkspaceProvider {
	return &WorkspaceProvider{
		Location: location,
		hooks:    hooks,
	}
}

func (wf *WorkspaceProvider) NewWorkspace(ctx context.Context, instanceID, location string, create WorkspaceFactory) (ws *session.Workspace, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "WorkspaceProvider.Create")
	tracing.ApplyOWI(span, log.OWI("", "", instanceID))
	defer tracing.FinishSpan(span, &err)

	ws, err = create(ctx, location)
	if err != nil {
		return nil, err
	}

	if ws.NonPersistentAttrs == nil {
		ws.NonPersistentAttrs = make(map[string]interface{})
	}

	err = wf.runLifecycleHooks(ctx, ws, session.WorkspaceInitializing)
	if err != nil {
		return nil, err
	}

	wf.workspaces.Store(instanceID, ws)

	return ws, nil
}

func (wf *WorkspaceProvider) Remove(ctx context.Context, instanceID string) {
	span, _ := opentracing.StartSpanFromContext(ctx, "WorkspaceProvider.Create")
	tracing.ApplyOWI(span, log.OWI("", "", instanceID))
	defer tracing.FinishSpan(span, nil)

	wf.workspaces.Delete(instanceID)
}

func (wf *WorkspaceProvider) GetAndConnect(ctx context.Context, instanceID string) (*session.Workspace, error) {
	ws, ok := wf.workspaces.Load(instanceID)
	if !ok {
		// if the workspace is not in memory ws-daemon probabably has been restarted
		// in that case we reload it from disk
		path := filepath.Join(wf.Location, fmt.Sprintf("%s.workspace.json", instanceID))
		loadWs, err := loadWorkspace(ctx, path)
		if err != nil {
			return nil, err
		}

		if loadWs.NonPersistentAttrs == nil {
			loadWs.NonPersistentAttrs = make(map[string]interface{})
		}

		ws = loadWs
	}

	err := wf.runLifecycleHooks(ctx, ws.(*session.Workspace), session.WorkspaceReady)
	if err != nil {
		return nil, err
	}
	wf.workspaces.Store(instanceID, ws)

	return ws.(*session.Workspace), nil
}

func (s *WorkspaceProvider) runLifecycleHooks(ctx context.Context, ws *session.Workspace, state session.WorkspaceState) error {
	hooks := s.hooks[state]
	log.WithFields(ws.OWI()).WithField("state", state).WithField("hooks", len(hooks)).Info("running lifecycle hooks")

	for _, h := range hooks {
		err := h(ctx, ws)
		if err != nil {
			return err
		}
	}
	return nil
}

func loadWorkspace(ctx context.Context, path string) (ws *session.Workspace, err error) {
	span, _ := opentracing.StartSpanFromContext(ctx, "loadWorkspace")
	defer tracing.FinishSpan(span, &err)

	fc, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot load session file: %w", err)
	}

	var workspace session.Workspace
	err = json.Unmarshal(fc, &workspace)
	if err != nil {
		return nil, fmt.Errorf("cannot unmarshal session file: %w", err)
	}

	return &workspace, nil
}
