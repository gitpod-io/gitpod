// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package session

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

var (
	// ErrAlreadyExists is returned when one tries to create a session which exists already
	ErrAlreadyExists = xerrors.Errorf("session already exists")
)

const (
	workspaceFilePattern = "*.workspace.json"
)

// WorkspaceLivecycleHook can modify a workspace's non-persistent state.
// They're intended to start regular operations or initialize non-persistent objects.
type WorkspaceLivecycleHook func(ctx context.Context, ws *Workspace) error

// Store maintains multiple workspaces, can add, remove, update them and keep it's state persistent on disk
type Store struct {
	Location string

	hooks          map[WorkspaceState][]WorkspaceLivecycleHook
	workspaces     map[string]*Workspace
	workspacesLock sync.Mutex
}

// NewStore creates a new session store.
// If a store previously existed at that location, all previous workspaces are restored.
func NewStore(ctx context.Context, location string, hooks map[WorkspaceState][]WorkspaceLivecycleHook) (res *Store, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "NewStore")
	defer tracing.FinishSpan(span, &err)

	res = &Store{
		Location:   location,
		hooks:      hooks,
		workspaces: make(map[string]*Workspace),
	}

	existingWorkspaces, err := filepath.Glob(filepath.Join(location, workspaceFilePattern))
	if err != nil {
		return nil, xerrors.Errorf("cannot list existing workspaces: %w", err)
	}
	for _, sf := range existingWorkspaces {
		session, err := loadWorkspace(ctx, sf)
		if err != nil {
			log.WithError(err).WithField("name", sf).Warn("cannot load session - this workspace is lost")
			continue
		}
		session.store = res

		err = res.runLifecycleHooks(ctx, session)
		if err != nil {
			log.WithError(err).WithField("name", sf).Warn("cannot load session - this workspace is lost")
			continue
		}

		res.workspaces[session.InstanceID] = session
	}
	log.WithField("location", location).WithField("workspacesLoaded", len(res.workspaces)).WithField("workspacesOnDisk", len(existingWorkspaces)).Info("restored workspaces from disk")

	return res, nil
}

func (s *Store) runLifecycleHooks(ctx context.Context, ws *Workspace) error {
	hooks := s.hooks[ws.state]
	log.WithFields(ws.OWI()).WithField("state", ws.state).WithField("hooks", len(hooks)).Debug("running lifecycle hooks")

	for _, h := range hooks {
		err := h(ctx, ws)
		if err != nil {
			return err
		}
	}
	return nil
}

// WorkspaceFactory creates a new fully configured workspace
type WorkspaceFactory func(ctx context.Context, location string) (*Workspace, error)

// NewWorkspace creates a new workspace in this store.
// CheckoutLocation is relative to location.
func (s *Store) NewWorkspace(ctx context.Context, instanceID, location string, create WorkspaceFactory) (res *Workspace, err error) {
	s.workspacesLock.Lock()
	defer s.workspacesLock.Unlock()

	res, exists := s.workspaces[instanceID]
	if exists {
		return res, ErrAlreadyExists
	}

	res, err = create(ctx, location)
	if err != nil {
		return nil, err
	}
	res.state = WorkspaceInitializing
	if res.NonPersistentAttrs == nil {
		res.NonPersistentAttrs = make(map[string]interface{})
	}
	res.operatingCondition = sync.NewCond(&sync.Mutex{})
	res.store = s
	err = s.runLifecycleHooks(ctx, res)
	if err != nil {
		return nil, err
	}
	s.workspaces[instanceID] = res

	return res, nil
}

// Delete removes a session from this session store
func (s *Store) Delete(ctx context.Context, name string) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "Store.Delete")
	defer tracing.FinishSpan(span, &err)

	s.workspacesLock.Lock()
	defer s.workspacesLock.Unlock()

	session, exists := s.workspaces[name]
	if !exists {
		return nil
	}

	err = session.Dispose(ctx)
	if err != nil {
		return xerrors.Errorf("cannot delete session: %w", err)
	}

	delete(s.workspaces, name)
	return nil
}

// Get retrieves a workspace
func (s *Store) Get(instanceID string) *Workspace {
	s.workspacesLock.Lock()
	defer s.workspacesLock.Unlock()

	return s.workspaces[instanceID]
}

// StartHousekeeping starts garbage collection and regular cleanup.
// This function returns when the context is canceled.
func (s *Store) StartHousekeeping(ctx context.Context, interval time.Duration) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "Store.StartHousekeeping")
	defer tracing.FinishSpan(span, nil)
	log.WithField("interval", interval.String()).Debug("started workspace housekeeping")

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	run := true
	for run {
		var errs []error
		select {
		case <-ticker.C:
			errs = s.doHousekeeping(ctx)
		case <-ctx.Done():
			run = false
			break
		}

		for _, err := range errs {
			log.WithError(err).Error("error during housekeeping")
		}
	}

	span.Finish()
	log.Debug("stopping workspace housekeeping")
}

func (s *Store) doHousekeeping(ctx context.Context) (errs []error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "doHousekeeping")
	defer func() {
		msgs := make([]string, len(errs))
		for i, err := range errs {
			msgs[i] = err.Error()
		}

		var err error
		if len(msgs) > 0 {
			err = xerrors.Errorf(strings.Join(msgs, ". "))
		}
		tracing.FinishSpan(span, &err)
	}()

	errs = make([]error, 0)

	// find session files which are no longer needed
	// TODO: This broke with FWB where the actual content can lay somewhere completely different
	//       Really we should not never remove workspaces from the ws-daemon side, but instead have
	//       ws-manager do that for us.

	// existingWorkspaces, err := filepath.Glob(filepath.Join(s.Location, workspaceFilePattern))
	// if err != nil {
	// 	return []error{xerrors.Errorf("cannot list existing workspaces: %w", err)}
	// }
	// for _, ws := range existingWorkspaces {
	// 	contentDirPath := strings.TrimSuffix(ws, ".workspace.json")
	// 	if _, err := os.Stat(contentDirPath); err == nil || !os.IsNotExist(err) {
	// 		// content directory still exists - we're good here
	// 		continue
	// 	}

	// 	name := strings.TrimSuffix(filepath.Base(ws), ".json")
	// 	err = s.Delete(ctx, name)
	// 	if err != nil {
	// 		log.WithError(err).Warn("Found workspace without workspace content, but cannot delete from store")
	// 		errs = append(errs, err)
	// 		continue
	// 	}

	// 	// if we didn't get the name right, or didn't have the session loaded (e.g. because it's broken),
	// 	// we might still have to delete the JSON file.
	// 	if _, err := os.Stat(contentDirPath); err == nil || !os.IsNotExist(err) {
	// 		err := os.Remove(ws)
	// 		if err != nil {
	// 			log.WithError(err).Warn("Found workspace without workspace content, delete from store, but cannot delete from filesystem. We'll inadvertantly load this workspace again upon restart.")
	// 			errs = append(errs, err)
	// 			continue
	// 		}
	// 	}

	// 	log.WithField("workspace", ws).Info("deleted workspaces without content directory")
	// }

	// find workspace directories which are left over.
	// For the time being we won't do that because we're not sure we're the only ones working in this directory!
	// Legacy ws-daemon will work here too.
	//
	// files, err := os.ReadDir(s.Location)
	// if err != nil {
	// 	return []error{xerrors.Errorf("cannot list existing workspaces content directory: %w", err)}
	// }
	// for _, f := range files {
	// 	if !f.IsDir() {
	// 		continue
	// 	}

	// 	loc := filepath.Join(s.Location, f.Name())
	// 	if _, err := os.Stat(fmt.Sprintf("%s.workspace.json", loc)); !os.IsNotExist(err) {
	// 		continue
	// 	}

	// 	// We have found a workspace content directory without a workspace state file, which means we don't manage this folder.
	// 	// Within the working area/location of a session store we must be the only one who creates directories, because we want to
	// 	// make sure we don't leak files over time.
	// 	err := os.RemoveAll(loc)
	// 	if err != nil {
	// 		log.WithError(err).Warn("Found workspace content directory without a corresponding state file, but could not delete the content directory")
	// 		errs = append(errs, err)
	// 		continue
	// 	}

	// 	log.WithField("directory", f.Name()).Info("deleted workspace content directory without corresponding state file")
	// }

	return errs
}
