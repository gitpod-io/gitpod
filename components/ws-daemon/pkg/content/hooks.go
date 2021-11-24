// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content

import (
	"context"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	"golang.org/x/xerrors"
)

// workspaceLifecycleHooks configures the lifecycle hooks for all workspaces
func workspaceLifecycleHooks(cfg Config, kubernetesNamespace string, workspaceExistenceCheck WorkspaceExistenceCheck, uidmapper *iws.Uidmapper, xfs *quota.XFS) map[session.WorkspaceState][]session.WorkspaceLivecycleHook {
	// startIWS starts the in-workspace service for a workspace. This lifecycle hook is idempotent, hence can - and must -
	// be called on initialization and ready. The on-ready hook exists only to support ws-daemon restarts.
	startIWS := iws.ServeWorkspace(uidmapper, api.FSShiftMethod(cfg.UserNamespaces.FSShift))

	return map[session.WorkspaceState][]session.WorkspaceLivecycleHook{
		session.WorkspaceInitializing: {
			hookSetupRemoteStorage(cfg),
			hookSetupWorkspaceLocation,
			hookInstallQuota(xfs, cfg.WorkspaceSizeLimit),
			startIWS,
		},
		session.WorkspaceReady: {
			hookSetupRemoteStorage(cfg),
			hookInstallQuota(xfs, cfg.WorkspaceSizeLimit),
			startIWS,
		},
		session.WorkspaceDisposed: {
			iws.StopServingWorkspace,
			hookRemoveQuota(xfs),
		},
	}
}

// hookSetupRemoteStorage configures the remote storage for a workspace
func hookSetupRemoteStorage(cfg Config) session.WorkspaceLivecycleHook {
	return func(ctx context.Context, ws *session.Workspace) error {
		if _, ok := ws.NonPersistentAttrs[session.AttrRemoteStorage]; !ws.RemoteStorageDisabled && !ok {
			remoteStorage, err := storage.NewDirectAccess(&cfg.Storage)
			if err != nil {
				return xerrors.Errorf("cannot use configured storage: %w", err)
			}

			err = remoteStorage.Init(ctx, ws.Owner, ws.WorkspaceID, ws.InstanceID)
			if err != nil {
				return xerrors.Errorf("cannot use configured storage: %w", err)
			}

			err = remoteStorage.EnsureExists(ctx)
			if err != nil {
				return xerrors.Errorf("cannot use configured storage: %w", err)
			}

			ws.NonPersistentAttrs[session.AttrRemoteStorage] = remoteStorage
		}

		return nil
	}
}

// hookSetupWorkspaceLocation recreates the workspace location
func hookSetupWorkspaceLocation(ctx context.Context, ws *session.Workspace) error {
	if ws.FullWorkspaceBackup {
		// nothing to do here for FWB. FWB workspaces don't have a location.
		return nil
	}

	location := ws.Location

	// 1. Clean out the workspace directory
	if _, err := os.Stat(location); os.IsNotExist(err) {
		// in the very unlikely event that the workspace Pod did not mount (and thus create) the workspace directory, create it
		err = os.Mkdir(location, 0755)
		if os.IsExist(err) {
			log.WithError(err).WithField("location", location).Debug("ran into non-atomic workspace location existence check")
		} else if err != nil {
			return xerrors.Errorf("cannot create workspace: %w", err)
		}
	}

	// Chown the workspace directory
	err := os.Chown(location, initializer.GitpodUID, initializer.GitpodGID)
	if err != nil {
		return xerrors.Errorf("cannot create workspace: %w", err)
	}
	return nil
}

// hookInstallQuota enforces filesystem quota on the workspace location (if the filesystem supports it)
func hookInstallQuota(xfs *quota.XFS, size quota.Size) session.WorkspaceLivecycleHook {
	return func(ctx context.Context, ws *session.Workspace) error {
		if xfs == nil {
			return nil
		}
		if size == 0 {
			return nil
		}

		if ws.XFSProjectID != 0 {
			xfs.RegisterProject(ws.XFSProjectID)
			return nil
		}

		prj, err := xfs.SetQuota(ws.Location, size)
		if err != nil {
			log.WithFields(ws.OWI()).WithError(err).Warn("cannot enforce workspace size limit")
		}
		ws.XFSProjectID = int(prj)

		return nil
	}
}

// hookRemoveQuota removes the filesystem quota, freeing up resources if need be
func hookRemoveQuota(xfs *quota.XFS) session.WorkspaceLivecycleHook {
	return func(ctx context.Context, ws *session.Workspace) error {
		if xfs == nil {
			return nil
		}

		if xfs == nil {
			return nil
		}
		if ws.XFSProjectID == 0 {
			return nil
		}

		return xfs.RemoveQuota(ws.XFSProjectID)
	}
}
