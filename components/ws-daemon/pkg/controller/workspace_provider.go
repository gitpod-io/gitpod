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

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
)

type WorkspaceProvider struct {
	hooks      map[session.WorkspaceState][]session.WorkspaceLivecycleHook
	Location   string
	workspaces map[string]struct{}
}

func NewWorkspaceProvider(hooks map[session.WorkspaceState][]session.WorkspaceLivecycleHook, location string) *WorkspaceProvider {
	return &WorkspaceProvider{
		hooks:      hooks,
		Location:   location,
		workspaces: make(map[string]struct{}),
	}
}

func (wf *WorkspaceProvider) Create(ctx context.Context, instanceID, location string, create session.WorkspaceFactory) (ws *session.Workspace, err error) {
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
	wf.workspaces[instanceID] = struct{}{}

	return ws, nil
}

func (wf *WorkspaceProvider) Get(ctx context.Context, instanceID string) (*session.Workspace, error) {
	path := filepath.Join(wf.Location, fmt.Sprintf("%s.workspace.json", instanceID))
	ws, err := loadWorkspace(ctx, path)
	if err != nil {
		return nil, err
	}

	if ws.NonPersistentAttrs == nil {
		ws.NonPersistentAttrs = make(map[string]interface{})
	}

	if _, ok := wf.workspaces[instanceID]; ok {
		return ws, nil
	}

	log.Infof("Reconnecting workspace %s to IWS", instanceID)
	err = wf.runLifecycleHooks(ctx, ws, session.WorkspaceReady)
	if err != nil {
		return nil, err
	}

	return ws, nil
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
