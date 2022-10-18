// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package session

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
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
	span, ctx := opentracing.StartSpanFromContext(ctx, "Store.NewWorkspace")
	tracing.ApplyOWI(span, log.OWI("", "", instanceID))
	defer tracing.FinishSpan(span, &err)

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
	defer delete(s.workspaces, name)

	err = session.Dispose(ctx)
	if err != nil {
		return xerrors.Errorf("cannot delete session for workspace %s: %w", session.InstanceID, err)
	}

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

// For good measure, we only GC ontent directories older than this age.
const minContentGCAge = 2 * time.Hour

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

	// }

	// Find workspace directories which are left over.
	files, err := os.ReadDir(s.Location)
	if err != nil {
		return []error{xerrors.Errorf("cannot list existing workspaces content directory: %w", err)}
	}
	for _, f := range files {
		if !f.IsDir() {
			continue
		}

		// If this is the -daemon directory, make sure we assume the correct state file name
		name := f.Name()
		name = strings.TrimSuffix(name, string(filepath.Separator))
		name = strings.TrimSuffix(name, "-daemon")

		if _, err := os.Stat(filepath.Join(s.Location, fmt.Sprintf("%s.workspace.json", name))); !errors.Is(err, fs.ErrNotExist) {
			continue
		}

		// We have found a workspace content directory without a workspace state file, which means we don't manage this folder.
		// Within the working area/location of a session store we must be the only one who creates directories, because we want to
		// make sure we don't leak files over time.

		// For good measure we wait a while before deleting that directory.
		nfo, err := f.Info()
		if err != nil {
			log.WithError(err).Warn("Found workspace content directory without a corresponding state file, but could not retrieve its info")
			errs = append(errs, err)
			continue
		}
		if time.Since(nfo.ModTime()) < minContentGCAge {
			continue
		}

		err = os.RemoveAll(filepath.Join(s.Location, f.Name()))
		if err != nil {
			log.WithError(err).Warn("Found workspace content directory without a corresponding state file, but could not delete the content directory")
			errs = append(errs, err)
			continue
		}

		log.WithField("directory", f.Name()).Info("deleted workspace content directory without corresponding state file")
	}

	return errs
}
