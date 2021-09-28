// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package session

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
)

const (
	// AttrRemoteStorage is the name of the remote storage associated with a workspace.
	// Expect this to be an instance of storage.RemoteStorage
	AttrRemoteStorage = "remote-storage"

	// AttrWorkspaceServer is the name of the workspace server cancel func.
	// Expect this to be an instance of context.CancelFunc
	AttrWorkspaceServer = "workspace-server"

	// AttrWaitForContent is the name of the wait-for-content probe cancel func.
	// Expect this to be an instance of context.CancelFunc
	AttrWaitForContent = "wait-for-content"
)

const (
	// maxPendingChanges is the limit beyond which we no longer report pending changes.
	// For example, if a workspace has then 150 untracked files, we'll report the first
	// 100 followed by "... and 50 more".
	//
	// We do this to keep the load on our infrastructure light and because beyond this number
	// the changes are irrelevant anyways.
	maxPendingChanges = 100
)

// Workspace is a single workspace on-disk that we're managing.
type Workspace struct {
	// Location is the absolute path in the local filesystem where to find this workspace
	Location string `json:"location"`
	// CheckoutLocation is the path relative to location where the main Git working copy of this
	// workspace resides. If this workspace has no Git working copy, this field is an empty string.
	CheckoutLocation string `json:"checkoutLocation"`

	CreatedAt           time.Time        `json:"createdAt"`
	DoBackup            bool             `json:"doBackup"`
	Owner               string           `json:"owner"`
	WorkspaceID         string           `json:"metaID"`
	InstanceID          string           `json:"workspaceID"`
	LastGitStatus       *csapi.GitStatus `json:"lastGitStatus"`
	FullWorkspaceBackup bool             `json:"fullWorkspaceBackup"`
	ContentManifest     []byte           `json:"contentManifest"`

	ServiceLocNode   string `json:"serviceLocNode"`
	ServiceLocDaemon string `json:"serviceLocDaemon"`

	RemoteStorageDisabled bool `json:"remoteStorageDisabled,omitempty"`

	NonPersistentAttrs map[string]interface{} `json:"-"`

	store              *Store
	state              WorkspaceState
	stateLock          sync.RWMutex
	operatingCondition *sync.Cond
}

// OWI produces the owner, workspace, instance log metadata from the information
// of this workspace.
func (s *Workspace) OWI() logrus.Fields {
	return log.OWI(s.Owner, s.WorkspaceID, s.InstanceID)
}

// WorkspaceState is the lifecycle state of a workspace
type WorkspaceState string

const (
	// WorkspaceInitializing means the workspace content is is currently being initialized
	WorkspaceInitializing WorkspaceState = "initializing"
	// WorkspaceReady means the workspace content is available on disk
	WorkspaceReady WorkspaceState = "ready"
	// WorkspaceDisposing means the workspace content is currently being backed up and removed from disk.
	// No workspace content modifications must take place anymore.
	WorkspaceDisposing WorkspaceState = "disposing"
	// WorkspaceDisposed means the workspace content has been backed up and will be removed from disk soon.
	WorkspaceDisposed WorkspaceState = "disposed"
)

// WaitForInit waits until this workspace is initialized
func (s *Workspace) WaitForInit(ctx context.Context) (ready bool) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "workspace.WaitForInit")
	defer tracing.FinishSpan(span, nil)

	s.stateLock.RLock()
	if s.state == WorkspaceReady {
		s.stateLock.RUnlock()
		return true
	} else if s.state != WorkspaceInitializing {
		s.stateLock.RUnlock()
		return false
	}
	s.stateLock.RUnlock()

	s.operatingCondition.L.Lock()
	s.operatingCondition.Wait()
	ready = true
	s.operatingCondition.L.Unlock()
	return
}

// MarkInitDone marks this workspace as initialized and writes this workspace to disk so that it can be restored should ws-daemon crash/be restarted
func (s *Workspace) MarkInitDone(ctx context.Context) (err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "workspace.MarkInitDone")
	defer tracing.FinishSpan(span, &err)

	// We persist before changing state so that we only mark everything as ready
	// if we actually have a persistent workspace. Otherwise we might have wsman thinking
	// something different than a restarted ws-daemon.
	err = s.persist()
	if err != nil {
		return xerrors.Errorf("cannot mark init done: %w", err)
	}

	s.stateLock.Lock()
	s.state = WorkspaceReady
	s.operatingCondition.Broadcast()
	s.stateLock.Unlock()

	err = s.store.runLifecycleHooks(ctx, s)
	if err != nil {
		return err
	}

	// Now that the rest of the world know's we're ready, we have to remember that ourselves.
	err = s.persist()
	if err != nil {
		return xerrors.Errorf("cannot mark init done: %w", err)
	}

	return nil
}

// WaitOrMarkForDisposal marks the workspace as disposing, or if it's already in that state waits until it's actually disposed
func (s *Workspace) WaitOrMarkForDisposal(ctx context.Context) (done bool, repo *csapi.GitStatus, err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "workspace.WaitOrMarkForDisposal")
	defer tracing.FinishSpan(span, &err)

	s.stateLock.Lock()
	if s.state == WorkspaceDisposed {
		s.stateLock.Unlock()
		return true, nil, nil
	} else if s.state != WorkspaceDisposing {
		s.state = WorkspaceDisposing
		s.stateLock.Unlock()

		err = s.persist()
		if err != nil {
			return false, nil, xerrors.Errorf("cannot mark as disposing: %w", err)
		}

		err = s.store.runLifecycleHooks(ctx, s)
		if err != nil {
			return false, nil, err
		}

		return false, nil, nil
	}
	s.stateLock.Unlock()

	s.operatingCondition.L.Lock()
	s.operatingCondition.Wait()
	done = true
	repo = s.LastGitStatus
	s.operatingCondition.L.Unlock()
	return
}

// Dispose marks the workspace as disposed and clears it from disk
func (s *Workspace) Dispose(ctx context.Context) (err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "workspace.Dispose")
	defer tracing.FinishSpan(span, &err)

	// we remove the workspace file first, so that should something go wrong while deleting the
	// old workspace content we can garbage collect that content later.
	err = os.Remove(s.persistentStateLocation())
	if err != nil {
		return xerrors.Errorf("cannot remove workspace: %w", err)
	}

	s.stateLock.Lock()
	s.state = WorkspaceDisposed
	s.operatingCondition.Broadcast()
	s.stateLock.Unlock()

	err = s.store.runLifecycleHooks(ctx, s)
	if err != nil {
		return err
	}

	if !s.FullWorkspaceBackup {
		err = os.RemoveAll(s.Location)
	}
	if err != nil {
		return xerrors.Errorf("cannot remove workspace: %w", err)
	}

	return nil
}

// IsReady returns true if the workspace is in the ready state
func (s *Workspace) IsReady() bool {
	s.stateLock.RLock()
	r := s.state == WorkspaceReady
	s.stateLock.RUnlock()
	return r
}

// IsDisposing returns true if the workspace is in the disposing/disposed state
func (s *Workspace) IsDisposing() bool {
	s.stateLock.RLock()
	r := s.state == WorkspaceDisposing || s.state == WorkspaceDisposed
	s.stateLock.RUnlock()
	return r
}

// SetGitStatus sets the last git status field and persists the change
func (s *Workspace) SetGitStatus(status *csapi.GitStatus) error {
	s.stateLock.Lock()
	s.LastGitStatus = status
	s.stateLock.Unlock()

	return s.persist()
}

// UpdateGitStatus attempts to update the LastGitStatus from the workspace's local working copy.
func (s *Workspace) UpdateGitStatus(ctx context.Context) (res *csapi.GitStatus, err error) {
	loc := s.Location
	if loc == "" {
		// FWB workspaces don't have `Location` set, but rather ServiceLocDaemon and ServiceLocNode.
		// We'd can't easily produce the Git status, because in this context `mark` isn't mounted, and `upper`
		// only contains the full git working copy if the content was just initialised.
		// Something like
		//   loc = filepath.Join(s.ServiceLocDaemon, "mark", "workspace")
		// does not work.
		//
		// TODO(cw): figure out a way to get ahold of the Git status.
		log.WithField("loc", loc).WithFields(s.OWI()).Debug("not updating Git status of FWB workspace")
		return
	}

	if s.CheckoutLocation == "" {
		log.WithField("loc", loc).WithFields(s.OWI()).Debug("did not have a Git location - not updating Git status")
		return
	}
	loc = filepath.Join(loc, s.CheckoutLocation)
	if !git.IsWorkingCopy(loc) {
		log.WithField("loc", loc).WithFields(s.OWI()).Debug("did not find a Git working copy - not updating Git status")
		return nil, nil
	}

	c := git.Client{Location: loc}
	stat, err := c.Status(ctx)
	if err != nil {
		return nil, err
	}

	s.LastGitStatus = toGitStatus(stat)

	err = s.persist()
	if err != nil {
		log.WithError(err).WithFields(s.OWI()).Warn("cannot persist latest Git status")
		err = nil
	}

	return s.LastGitStatus, nil
}

func toGitStatus(s *git.Status) *csapi.GitStatus {
	limit := func(entries []string) []string {
		if len(entries) > maxPendingChanges {
			return append(entries[0:maxPendingChanges], fmt.Sprintf("... and %d more", len(entries)-maxPendingChanges))
		}

		return entries
	}

	return &csapi.GitStatus{
		Branch:               s.BranchHead,
		LatestCommit:         s.LatestCommit,
		UncommitedFiles:      limit(s.UncommitedFiles),
		TotalUncommitedFiles: int64(len(s.UncommitedFiles)),
		UntrackedFiles:       limit(s.UntrackedFiles),
		TotalUntrackedFiles:  int64(len(s.UntrackedFiles)),
		UnpushedCommits:      limit(s.UnpushedCommits),
		TotalUnpushedCommits: int64(len(s.UnpushedCommits)),
	}
}

type persistentWorkspace struct {
	*Workspace
	State WorkspaceState `json:"state"`
}

func (s *Workspace) persistentStateLocation() string {
	return filepath.Join(s.store.Location, fmt.Sprintf("%s.workspace.json", s.InstanceID))
}

func (s *Workspace) persist() error {
	s.stateLock.RLock()
	fc, err := json.Marshal(persistentWorkspace{s, s.state})
	s.stateLock.RUnlock()
	if err != nil {
		return xerrors.Errorf("cannot persist workspace: %w", err)
	}

	err = os.WriteFile(s.persistentStateLocation(), fc, 0644)
	if err != nil {
		return xerrors.Errorf("cannot persist workspace: %w", err)
	}

	return nil
}

func loadWorkspace(ctx context.Context, path string) (sess *Workspace, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "loadWorkspace")
	defer tracing.FinishSpan(span, &err)

	fc, err := os.ReadFile(path)
	if err != nil {
		return nil, xerrors.Errorf("cannot load session file: %w", err)
	}

	var p persistentWorkspace
	err = json.Unmarshal(fc, &p)
	if err != nil {
		return nil, xerrors.Errorf("cannot load session file: %w", err)
	}

	res := p.Workspace
	res.NonPersistentAttrs = make(map[string]interface{})
	res.state = p.State
	res.operatingCondition = sync.NewCond(&sync.Mutex{})

	return res, nil
}
