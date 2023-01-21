// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"fmt"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"

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
	MetricsRegistry  prometheus.Registerer
}

type WorkspaceController struct {
	client.Client
	NodeName   string
	opts       *WorkspaceControllerOpts
	operations WorkspaceOperations
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

	ops, err := NewWorkspaceOperations(opts.ContentConfig, store, opts.MetricsRegistry)
	if err != nil {
		return nil, err
	}

	return &WorkspaceController{
		Client:     c,
		NodeName:   opts.NodeName,
		opts:       &opts,
		operations: *ops,
	}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (wsc *WorkspaceController) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&workspacev1.Workspace{}).
		Complete(wsc)
}

func (wsc *WorkspaceController) Reconcile(ctx context.Context, req ctrl.Request) (result ctrl.Result, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "Reconcile")
	defer tracing.FinishSpan(span, &err)
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

	log.WithValues("workspaceID", workspace.Name, "phase", workspace.Status.Phase).Info("seen workspace we have to manage")

	if workspace.Status.Phase == workspacev1.WorkspacePhaseCreating ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseInitializing ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseRunning {

		result, err = wsc.handleWorkspaceInit(ctx, &workspace, req)
		return result, err
	}

	if workspace.Status.Phase == workspacev1.WorkspacePhaseStopping {
		result, err = wsc.handleWorkspaceStop(ctx, &workspace)
		return result, err
	}

	return ctrl.Result{}, nil
}

func (wsc *WorkspaceController) handleWorkspaceInit(ctx context.Context, ws *workspacev1.Workspace, req ctrl.Request) (result ctrl.Result, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "handleWorkspaceInit")
	defer tracing.FinishSpan(span, &err)

	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c == nil {
		var init csapi.WorkspaceInitializer
		err = proto.Unmarshal(ws.Spec.Initializer, &init)
		if err != nil {
			err = fmt.Errorf("cannot unmarshal initializer config: %w", err)
			return ctrl.Result{}, err
		}

		alreadyInit, failure, err := wsc.operations.InitWorkspaceContent(ctx, InitContentOptions{
			Meta: WorkspaceMeta{
				Owner:       ws.Spec.Ownership.Owner,
				WorkspaceId: ws.Spec.Ownership.WorkspaceID,
				InstanceId:  ws.Name,
			},
			Initializer: &init,
			Headless:    ws.Status.Headless,
		})

		if err != nil {
			return ctrl.Result{}, fmt.Errorf("could not initialize workspace %s: %w", ws.Name, err)
		}

		if alreadyInit {
			return ctrl.Result{}, nil
		}

		err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
			var workspace workspacev1.Workspace
			if err := wsc.Get(ctx, req.NamespacedName, &workspace); err != nil {
				return err
			}

			if failure != "" {
				workspace.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionContentReady),
					Status:             metav1.ConditionFalse,
					Message:            failure,
					Reason:             "InitializationFailure",
					LastTransitionTime: metav1.Now(),
				})
			} else {
				workspace.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionContentReady),
					Status:             metav1.ConditionTrue,
					Reason:             "InitializationSuccess",
					LastTransitionTime: metav1.Now(),
				})
			}

			return wsc.Status().Update(ctx, &workspace)
		})

		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

func (wsc *WorkspaceController) handleWorkspaceStop(ctx context.Context, ws *workspacev1.Workspace) (result ctrl.Result, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "handleWorkspaceInit")
	defer tracing.FinishSpan(span, &err)
	log := log.FromContext(ctx)

	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c == nil || c.Status == metav1.ConditionFalse {
		return ctrl.Result{}, fmt.Errorf("workspace content was never ready")
	}

	log.WithValues("workspaceID", ws.Name, "runtime", ws.Status.Runtime).Info("DISPOSING WORKSPACE")
	alreadyDisposing, gitStatus, disposeErr := wsc.operations.DisposeWorkspace(ctx, DisposeOptions{
		Meta: WorkspaceMeta{
			Owner:       ws.Spec.Ownership.Owner,
			WorkspaceId: ws.Spec.Ownership.WorkspaceID,
			InstanceId:  ws.Name,
		},
		WorkspaceLocation: ws.Spec.WorkspaceLocation,
		BackupLogs:        ws.Spec.Type == workspacev1.WorkspaceTypePrebuild,
	})

	if disposeErr != nil {
		log.Error(disposeErr, "failed to dispose workspace", "workspace", ws.Name)
		err = fmt.Errorf("failed to dispose workspace %s: %w", ws.Name, disposeErr)
		return ctrl.Result{}, err
	}

	if alreadyDisposing {
		return ctrl.Result{}, nil
	}

	ws.Status.GitStatus = toWorkspaceGitStatus(gitStatus)

	err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
		if disposeErr != nil {
			ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
				Type:               string(workspacev1.WorkspaceConditionBackupFailure),
				Status:             metav1.ConditionTrue,
				Reason:             "BackupFailed",
				Message:            disposeErr.Error(),
				LastTransitionTime: metav1.Now(),
			})
		} else {
			ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
				Type:               string(workspacev1.WorkspaceConditionBackupComplete),
				Status:             metav1.ConditionTrue,
				Reason:             "BackupComplete",
				LastTransitionTime: metav1.Now(),
			})
		}

		return wsc.Status().Update(ctx, ws)
	})

	return ctrl.Result{}, err
}

func toWorkspaceGitStatus(status *csapi.GitStatus) *workspacev1.GitStatus {
	if status == nil {
		return nil
	}

	return &workspacev1.GitStatus{
		Branch:               status.Branch,
		LatestCommit:         status.LatestCommit,
		UncommitedFiles:      status.UncommitedFiles,
		TotalUncommitedFiles: status.TotalUncommitedFiles,
		UntrackedFiles:       status.UntrackedFiles,
		TotalUntrackedFiles:  status.TotalUntrackedFiles,
		UnpushedCommits:      status.UnpushedCommits,
		TotalUnpushedCommits: status.TotalUnpushedCommits,
	}
}
