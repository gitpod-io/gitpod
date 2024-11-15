// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package content

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// WorkspaceLifecycleHooks configures the lifecycle hooks for all workspaces
func WorkspaceLifecycleHooks(cfg Config, workspaceCIDR string, uidmapper *iws.Uidmapper, xfs *quota.XFS, cgroupMountPoint string) map[session.WorkspaceState][]session.WorkspaceLivecycleHook {
	// startIWS starts the in-workspace service for a workspace. This lifecycle hook is idempotent, hence can - and must -
	// be called on initialization and ready. The on-ready hook exists only to support ws-daemon restarts.
	startIWS := iws.ServeWorkspace(uidmapper, api.FSShiftMethod(cfg.UserNamespaces.FSShift), cgroupMountPoint, workspaceCIDR)

	return map[session.WorkspaceState][]session.WorkspaceLivecycleHook{
		session.WorkspaceInitializing: {
			hookSetupWorkspaceLocation,
			startIWS, // workspacekit is waiting for starting IWS, so it needs to start as soon as possible.
			hookSetupRemoteStorage(cfg),
			// When starting a workspace, use soft limit for the following reason to ensure content is restored
			// - workspacekit needs to generate some temporary file when starting a workspace
			// - when extracting tar file, tar command create some symlinks following a original content
			hookInstallQuota(xfs, false),
		},
		session.WorkspaceReady: {
			startIWS,
			hookSetupRemoteStorage(cfg),
			hookInstallQuota(xfs, true),
		},
		session.WorkspaceDisposed: {
			hookWipingTeardown(), // if ws.DoWipe == true: make sure we 100% tear down the workspace
			iws.StopServingWorkspace,
			hookRemoveQuota(xfs),
		},
	}
}

// hookSetupRemoteStorage configures the remote storage for a workspace
func hookSetupRemoteStorage(cfg Config) session.WorkspaceLivecycleHook {
	return func(ctx context.Context, ws *session.Workspace) (err error) {
		span, ctx := opentracing.StartSpanFromContext(ctx, "hook.SetupRemoteStorage")
		defer tracing.FinishSpan(span, &err)

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
func hookSetupWorkspaceLocation(ctx context.Context, ws *session.Workspace) (err error) {
	//nolint:ineffassign
	span, _ := opentracing.StartSpanFromContext(ctx, "hook.SetupWorkspaceLocation")
	defer tracing.FinishSpan(span, &err)
	location := ws.Location

	// 1. Clean out the workspace directory
	if _, err := os.Stat(location); errors.Is(err, fs.ErrNotExist) {
		// in the very unlikely event that the workspace Pod did not mount (and thus create) the workspace directory, create it
		err = os.Mkdir(location, 0755)
		if os.IsExist(err) {
			log.WithError(err).WithFields(ws.OWI()).WithField("location", location).Debug("ran into non-atomic workspace location existence check")
		} else if err != nil {
			return xerrors.Errorf("cannot create workspace: %w", err)
		}
	}

	// Chown the workspace directory
	err = os.Chown(location, initializer.GitpodUID, initializer.GitpodGID)
	if err != nil {
		return xerrors.Errorf("cannot create workspace: %w", err)
	}
	return nil
}

// hookInstallQuota enforces filesystem quota on the workspace location (if the filesystem supports it)
func hookInstallQuota(xfs *quota.XFS, isHard bool) session.WorkspaceLivecycleHook {
	return func(ctx context.Context, ws *session.Workspace) (err error) {
		span, _ := opentracing.StartSpanFromContext(ctx, "hook.InstallQuota")
		defer tracing.FinishSpan(span, &err)

		if xfs == nil {
			log.WithFields(ws.OWI()).Warn("no xfs definition")
			return nil
		}

		if ws.StorageQuota == 0 {
			log.WithFields(ws.OWI()).Warn("no storage quota defined")
			return nil
		}

		size := quota.Size(ws.StorageQuota)

		log.WithFields(ws.OWI()).WithField("isHard", isHard).WithField("size", size).WithField("directory", ws.Location).Debug("setting disk quota")

		var (
			prj int
		)
		if ws.XFSProjectID != 0 {
			xfs.RegisterProject(ws.XFSProjectID)
			prj, err = xfs.SetQuotaWithPrjId(ws.Location, size, ws.XFSProjectID, isHard)
		} else {
			prj, err = xfs.SetQuota(ws.Location, size, isHard)
		}

		if err != nil {
			log.WithFields(ws.OWI()).WithError(err).Warn("cannot enforce workspace size limit")
		}
		ws.XFSProjectID = int(prj)

		return nil
	}
}

// hookRemoveQuota removes the filesystem quota, freeing up resources if need be
func hookRemoveQuota(xfs *quota.XFS) session.WorkspaceLivecycleHook {
	return func(ctx context.Context, ws *session.Workspace) (err error) {
		span, _ := opentracing.StartSpanFromContext(ctx, "hook.RemoveQuota")
		defer tracing.FinishSpan(span, &err)

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

func hookWipingTeardown() session.WorkspaceLivecycleHook {
	return func(ctx context.Context, ws *session.Workspace) error {
		log := log.WithFields(ws.OWI())

		if !ws.DoWipe {
			// this is the "default" case for 99% of all workspaces
			// TODO(gpl): We should probably make this the default for all workspaces - but not with this PR
			return nil
		}

		socketFN := filepath.Join(ws.ServiceLocDaemon, "daemon.sock")
		conn, err := grpc.DialContext(ctx, "unix://"+socketFN, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.WithError(err).Error("error connecting to IWS for WipingTeardown")
			return nil
		}
		client := daemonapi.NewInWorkspaceServiceClient(conn)

		res, err := client.WipingTeardown(ctx, &daemonapi.WipingTeardownRequest{
			DoWipe: ws.DoWipe,
		})
		if err != nil {
			return err
		}
		log.WithField("success", res.Success).Debug("wiping teardown done")

		return nil
	}
}
