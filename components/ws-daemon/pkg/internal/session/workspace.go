// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
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

	CreatedAt       time.Time        `json:"createdAt"`
	DoBackup        bool             `json:"doBackup"`
	Owner           string           `json:"owner"`
	WorkspaceID     string           `json:"metaID"`
	InstanceID      string           `json:"workspaceID"`
	LastGitStatus   *csapi.GitStatus `json:"lastGitStatus"`
	ContentManifest []byte           `json:"contentManifest"`

	ServiceLocNode   string `json:"serviceLocNode"`
	ServiceLocDaemon string `json:"serviceLocDaemon"`

	RemoteStorageDisabled bool `json:"remoteStorageDisabled,omitempty"`
	StorageQuota          int  `json:"storageQuota,omitempty"`

	XFSProjectID int `json:"xfsProjectID"`

	NonPersistentAttrs map[string]interface{} `json:"-"`
}

// OWI produces the owner, workspace, instance log metadata from the information
// of this workspace.
func (s *Workspace) OWI() logrus.Fields {
	return log.OWI(s.Owner, s.WorkspaceID, s.InstanceID)
}

// WorkspaceState is the lifecycle state of a workspace
type WorkspaceState string

const (
	// WorkspaceInitializing means the workspace content is currently being initialized
	WorkspaceInitializing WorkspaceState = "initializing"
	// WorkspaceReady means the workspace content is available on disk
	WorkspaceReady WorkspaceState = "ready"
	// WorkspaceDisposing means the workspace content is currently being backed up and removed from disk.
	// No workspace content modifications must take place anymore.
	WorkspaceDisposing WorkspaceState = "disposing"
	// WorkspaceDisposed means the workspace content has been backed up and will be removed from disk soon.
	WorkspaceDisposed WorkspaceState = "disposed"
)

// WorkspaceLivecycleHook can modify a workspace's non-persistent state.
// They're intended to start regular operations or initialize non-persistent objects.
type WorkspaceLivecycleHook func(ctx context.Context, ws *Workspace) error

// Dispose marks the workspace as disposed and clears it from disk
func (s *Workspace) Dispose(ctx context.Context, hooks []WorkspaceLivecycleHook) (err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "workspace.Dispose")
	defer tracing.FinishSpan(span, &err)

	// we remove the workspace file first, so that should something go wrong while deleting the
	// old workspace content we can garbage collect that content later.
	err = os.Remove(s.persistentStateLocation())
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			log.WithError(err).WithFields(s.OWI()).Warn("workspace persistent state location not exist")
			err = nil
		} else {
			return xerrors.Errorf("cannot remove workspace persistent state location: %w", err)
		}
	}

	for _, h := range hooks {
		err := h(ctx, s)
		if err != nil {
			return err
		}
	}

	err = os.RemoveAll(s.Location)
	if err != nil {
		return xerrors.Errorf("cannot remove workspace all: %w", err)
	}

	return nil
}

// UpdateGitStatus attempts to update the LastGitStatus from the workspace's local working copy.
func (s *Workspace) UpdateGitStatus(ctx context.Context) (res *csapi.GitStatus, err error) {
	var loc string

	loc = s.Location
	if loc == "" {
		log.WithField("loc", loc).WithFields(s.OWI()).Debug("not updating Git status of FWB workspace")
		return
	}

	loc = filepath.Join(loc, s.CheckoutLocation)
	if !git.IsWorkingCopy(loc) {
		log.WithField("loc", loc).WithField("checkout location", s.CheckoutLocation).WithFields(s.OWI()).Debug("did not find a Git working copy - not updating Git status")
		return nil, nil
	}

	c := git.Client{Location: loc}

	stat, err := c.Status(ctx)
	if err != nil {
		return nil, err
	}

	s.LastGitStatus = toGitStatus(stat)

	err = s.Persist()
	if err != nil {
		log.WithError(err).WithFields(s.OWI()).Warn("cannot persist latest Git status")
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

func (s *Workspace) persistentStateLocation() string {
	return filepath.Join(filepath.Dir(s.Location), fmt.Sprintf("%s.workspace.json", s.InstanceID))
}

func (s *Workspace) Persist() error {
	fc, err := json.Marshal(s)
	if err != nil {
		return xerrors.Errorf("cannot marshal workspace: %w", err)
	}

	err = os.WriteFile(s.persistentStateLocation(), fc, 0644)
	if err != nil {
		return xerrors.Errorf("cannot persist workspace: %w", err)
	}

	return nil
}

func LoadWorkspace(ctx context.Context, path string) (sess *Workspace, err error) {
	span, _ := opentracing.StartSpanFromContext(ctx, "loadWorkspace")
	defer tracing.FinishSpan(span, &err)

	fc, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot load session file: %w", err)
	}

	var workspace Workspace
	err = json.Unmarshal(fc, &workspace)
	if err != nil {
		return nil, fmt.Errorf("cannot unmarshal session file: %w", err)
	}

	workspace.NonPersistentAttrs = make(map[string]interface{})
	return &workspace, nil
}
