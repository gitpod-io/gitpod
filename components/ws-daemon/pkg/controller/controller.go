// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"errors"
	"path/filepath"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"

	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

type WorkspaceControllerOpts struct {
	NodeName         string
	ContentConfig    content.Config
	UIDMapperConfig  iws.UidmapperConfig
	ContainerRuntime container.Runtime
	CGroupMountPoint string
}

type WorkspaceController struct {
	client.Client

	NodeName string

	opts  *WorkspaceControllerOpts
	store *session.Store
}

func NewWorkspaceController(c client.Client, opts WorkspaceControllerOpts) (*WorkspaceController, error) {
	xfs, err := quota.NewXFS(opts.ContentConfig.WorkingArea)
	if err != nil {
		return nil, err
	}
	store, err := session.NewStore(context.Background(), opts.ContentConfig.WorkingArea, content.WorkspaceLifecycleHooks(
		opts.ContentConfig,
		func(instanceID string) bool { return true },
		&iws.Uidmapper{Config: opts.UIDMapperConfig, Runtime: opts.ContainerRuntime},
		xfs,
		opts.CGroupMountPoint,
	))
	if err != nil {
		return nil, err
	}

	return &WorkspaceController{
		Client:   c,
		NodeName: opts.NodeName,
		opts:     &opts,
		store:    store,
	}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (wsc *WorkspaceController) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&workspacev1.Workspace{}).
		Complete(wsc)
}

func (wsc *WorkspaceController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	if err := wsc.Get(ctx, req.NamespacedName, &workspace); err != nil {
		// we'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	// not our workspace
	if workspace.Status.Runtime == nil || workspace.Status.Runtime.NodeName != wsc.NodeName {
		return ctrl.Result{}, nil
	}

	log.WithValues("workspaceID", workspace.Name, "runtime", workspace.Status.Runtime).Info("seen workspace we have to manage")

	if workspace.Status.Phase == workspacev1.WorkspacePhaseCreating ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseInitializing ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseRunning {

		if c := wsk8s.GetCondition(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c == nil {
			failure, err := wsc.initWorkspaceContent(ctx, &workspace)
			if err != nil {
				return ctrl.Result{}, err
			}

			// we retry because re-init would cause OTS to fail during the CollectRemoteContent run.
			// TODO(cw): make this reentrant
			err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
				var workspace workspacev1.Workspace
				err := wsc.Get(ctx, req.NamespacedName, &workspace)
				if err != nil {
					return err
				}

				if failure != "" {
					workspace.Status.Conditions = wsk8s.AddUniqueCondition(workspace.Status.Conditions, metav1.Condition{
						Type:               string(workspacev1.WorkspaceConditionContentReady),
						Status:             metav1.ConditionFalse,
						Message:            failure,
						Reason:             "failed to initialize",
						LastTransitionTime: metav1.Now(),
					})
				} else {
					workspace.Status.Conditions = wsk8s.AddUniqueCondition(workspace.Status.Conditions, metav1.Condition{
						Type:               string(workspacev1.WorkspaceConditionContentReady),
						Status:             metav1.ConditionTrue,
						Message:            "content is ready",
						LastTransitionTime: metav1.Now(),
					})
				}

				return wsc.Status().Update(ctx, &workspace)
			})
			if err != nil {
				return ctrl.Result{}, err
			}
		}
	}

	return ctrl.Result{}, nil
}

func (wsc *WorkspaceController) creator(ws *workspacev1.Workspace, init *csapi.WorkspaceInitializer) session.WorkspaceFactory {
	var checkoutLocation string
	allLocations := csapi.GetCheckoutLocationsFromInitializer(init)
	if len(allLocations) > 0 {
		checkoutLocation = allLocations[0]
	}

	serviceDirName := ws.Name + "-daemon"
	return func(ctx context.Context, location string) (res *session.Workspace, err error) {
		return &session.Workspace{
			Location:              location,
			CheckoutLocation:      checkoutLocation,
			CreatedAt:             time.Now(),
			Owner:                 ws.Spec.Ownership.Owner,
			WorkspaceID:           ws.Spec.Ownership.WorkspaceID,
			InstanceID:            ws.Name,
			FullWorkspaceBackup:   false,
			PersistentVolumeClaim: false,
			RemoteStorageDisabled: ws.Status.Headless,
			// StorageQuota:          int(req.StorageQuotaBytes),

			ServiceLocDaemon: filepath.Join(wsc.opts.ContentConfig.WorkingArea, serviceDirName),
			ServiceLocNode:   filepath.Join(wsc.opts.ContentConfig.WorkingAreaNode, serviceDirName),
		}, nil
	}
}

func (wsc *WorkspaceController) initWorkspaceContent(ctx context.Context, ws *workspacev1.Workspace) (failure string, err error) {
	var initializer csapi.WorkspaceInitializer
	err = proto.Unmarshal(ws.Spec.Initializer, &initializer)
	if err != nil {
		return "bug: cannot unmarshal initializer", xerrors.Errorf("cannot unmarshal init config: %w", err)
	}

	res, err := wsc.store.NewWorkspace(ctx, ws.Name, filepath.Join(wsc.store.Location, ws.Name), wsc.creator(ws, &initializer))
	if errors.Is(err, storage.ErrNotFound) {
		return "", nil
	}

	if err != nil {
		return "bug: cannot add workspace to store", xerrors.Errorf("cannot add workspace to store: %w", err)
	}

	rs, ok := res.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		return "bug: workspace has no remote storage", xerrors.Errorf("workspace has no remote storage")
	}
	ps, err := storage.NewPresignedAccess(&wsc.opts.ContentConfig.Storage)
	if err != nil {
		return "bug: no presigned storage available", xerrors.Errorf("no presigned storage available: %w", err)
	}

	remoteContent, err := content.CollectRemoteContent(ctx, rs, ps, ws.Spec.Ownership.Owner, &initializer)
	if err != nil {
		return "remote content error", xerrors.Errorf("remote content error: %w", err)
	}

	// Initialize workspace.
	// FWB workspaces initialize without the help of ws-daemon, but using their supervisor or the registry-facade.
	opts := content.RunInitializerOpts{
		Command: wsc.opts.ContentConfig.Initializer.Command,
		Args:    wsc.opts.ContentConfig.Initializer.Args,
		// This is a bit of a hack as it makes hard assumptions about the nature of the UID mapping.
		// Also, we cannot do this in wsinit because we're dropping all the privileges that would be
		// required for this operation.
		//
		// With FWB this bit becomes unneccesary.
		UID: (wsinit.GitpodUID + 100000 - 1),
		GID: (wsinit.GitpodGID + 100000 - 1),
		IdMappings: []archive.IDMapping{
			{ContainerID: 0, HostID: wsinit.GitpodUID, Size: 1},
			{ContainerID: 1, HostID: 100000, Size: 65534},
		},
		OWI: content.OWI{
			Owner:       ws.Spec.Ownership.Owner,
			WorkspaceID: ws.Spec.Ownership.WorkspaceID,
			InstanceID:  ws.Name,
		},
	}

	err = content.RunInitializer(ctx, res.Location, &initializer, remoteContent, opts)
	if err != nil {
		return err.Error(), err
	}

	return "", nil
}
