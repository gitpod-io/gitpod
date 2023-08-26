// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/log"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/activity"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/maintenance"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

func NewTimeoutReconciler(c client.Client, recorder record.EventRecorder, cfg config.Configuration, maintenance maintenance.Maintenance) (*TimeoutReconciler, error) {
	if cfg.HeartbeatInterval == 0 {
		return nil, fmt.Errorf("invalid heartbeat interval, must not be 0")
	}
	reconcileInterval := time.Duration(cfg.HeartbeatInterval)
	// Reconcile interval is half the heartbeat interval to catch timed out workspaces in time.
	// See https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem why we need this.
	reconcileInterval /= 2

	return &TimeoutReconciler{
		Client:            c,
		Config:            cfg,
		reconcileInterval: reconcileInterval,
		recorder:          recorder,
		maintenance:       maintenance,
	}, nil
}

// TimeoutReconciler reconciles workspace timeouts. This is a separate reconciler, as it
// always requeues events for existing workspaces such that timeouts are checked on (at least)
// a specified interval. The reconcile loop should therefore be light-weight as it's repeatedly
// reconciling all workspaces in the cluster.
type TimeoutReconciler struct {
	client.Client

	Config            config.Configuration
	reconcileInterval time.Duration
	recorder          record.EventRecorder
	maintenance       maintenance.Maintenance
}

//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/status,verbs=get;update;patch

// Reconcile will check the given workspace for timing out. When done, a new event gets
// requeued automatically to ensure the workspace gets reconciled at least every reconcileInterval.
func (r *TimeoutReconciler) Reconcile(ctx context.Context, req ctrl.Request) (result ctrl.Result, err error) {
	log := log.FromContext(ctx).WithValues("ws", req.NamespacedName)

	var workspace workspacev1.Workspace
	if err := r.Get(ctx, req.NamespacedName, &workspace); err != nil {
		if !apierrors.IsNotFound(err) {
			log.Error(err, "unable to fetch workspace")
		}
		// We'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		// On any other error, let the controller requeue an event with exponential
		// backoff.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if workspace.IsConditionTrue(workspacev1.WorkspaceConditionTimeout) {
		// Workspace has already been marked as timed out.
		// Return and don't requeue another reconciliation.
		return ctrl.Result{}, nil
	}

	if r.maintenance.IsEnabled(ctx) {
		// Don't reconcile timeouts in maintenance mode, to prevent workspace deletion.
		// Requeue after some time to ensure we do still reconcile this workspace when
		// maintenance mode ends.
		return ctrl.Result{RequeueAfter: maintenanceRequeue}, nil
	}

	// The workspace hasn't timed out yet. After this point, we always
	// want to requeue a reconciliation after the configured interval.
	defer func() {
		result.RequeueAfter = r.reconcileInterval
	}()

	timedout := r.isWorkspaceTimedOut(&workspace)
	if timedout == "" {
		// Hasn't timed out.
		return ctrl.Result{}, nil
	}

	// Workspace timed out, set Timeout condition.
	log.Info("Workspace timed out", "reason", timedout)
	if err = retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		err := r.Get(ctx, types.NamespacedName{Name: workspace.Name, Namespace: workspace.Namespace}, &workspace)
		if err != nil {
			return err
		}

		workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionTimeout(timedout))
		return r.Status().Update(ctx, &workspace)
	}); err != nil {
		log.Error(err, "Failed to update workspace status with Timeout condition")
		return ctrl.Result{}, fmt.Errorf("failed to add timeout condition: %w", err)
	}

	r.recorder.Event(&workspace, corev1.EventTypeNormal, "TimedOut", timedout)
	return ctrl.Result{}, nil
}

type timeoutActivity string

const (
	activityInit               timeoutActivity = "initialization"
	activityStartup            timeoutActivity = "startup"
	activityCreatingContainers timeoutActivity = "creating containers"
	activityPullingImages      timeoutActivity = "pulling images"
	activityRunningHeadless    timeoutActivity = "running the headless workspace"
	activityNone               timeoutActivity = "period of inactivity"
	activityMaxLifetime        timeoutActivity = "maximum lifetime"
	activityClosed             timeoutActivity = "after being closed"
	activityInterrupted        timeoutActivity = "workspace interruption"
	activityStopping           timeoutActivity = "stopping"
	activityBackup             timeoutActivity = "backup"
)

// isWorkspaceTimedOut determines if a workspace is timed out based on the manager configuration and state the pod is in.
// This function does NOT use the Timeout condition, but rather is used to set that condition in the first place.
func (r *TimeoutReconciler) isWorkspaceTimedOut(ws *workspacev1.Workspace) (reason string) {
	timeouts := r.Config.Timeouts
	phase := ws.Status.Phase

	decide := func(start time.Time, timeout util.Duration, activity timeoutActivity) string {
		td := time.Duration(timeout)
		inactivity := time.Since(start)
		if inactivity < td {
			return ""
		}

		return fmt.Sprintf("workspace timed out after %s (%s) took longer than %s", activity, formatDuration(inactivity), formatDuration(td))
	}

	start := ws.ObjectMeta.CreationTimestamp.Time
	lastActivity := activity.Last(ws)
	isClosed := ws.IsConditionTrue(workspacev1.WorkspaceConditionClosed)

	switch phase {
	case workspacev1.WorkspacePhasePending:
		return decide(start, timeouts.Initialization, activityInit)

	case workspacev1.WorkspacePhaseInitializing:
		return decide(start, timeouts.TotalStartup, activityStartup)

	case workspacev1.WorkspacePhaseCreating:
		activity := activityCreatingContainers
		// TODO:
		// if status.Conditions.PullingImages == api.WorkspaceConditionBool_TRUE {
		// 	activity = activityPullingImages
		// }
		return decide(start, timeouts.TotalStartup, activity)

	case workspacev1.WorkspacePhaseRunning:
		// First check is always for the max lifetime
		maxLifetime := r.getMaxLifetime(ws)
		if msg := decide(start, maxLifetime, activityMaxLifetime); msg != "" {
			return msg
		}

		timeout := timeouts.RegularWorkspace
		if customTimeout := ws.Spec.Timeout.Time; customTimeout != nil {
			timeout = util.Duration(customTimeout.Duration)
		}
		activity := activityNone
		if ws.IsHeadless() {
			timeout = timeouts.HeadlessWorkspace
			lastActivity = &start
			activity = activityRunningHeadless
		} else if lastActivity == nil {
			// The workspace is up and running, but the user has never produced any activity
			return decide(start, timeouts.TotalStartup, activityNone)
		} else if isClosed {
			reason := func() string {
				afterClosed := timeouts.AfterClose
				if customClosedTimeout := ws.Spec.Timeout.ClosedTimeout; customClosedTimeout != nil {
					afterClosed = util.Duration(customClosedTimeout.Duration)
					if afterClosed == 0 {
						return ""
					}
				}
				return decide(*lastActivity, afterClosed, activityClosed)
			}()
			if reason != "" {
				return reason
			}
		}
		return decide(*lastActivity, timeout, activity)

	case workspacev1.WorkspacePhaseStopping:
		if isWorkspaceBeingDeleted(ws) && !ws.IsConditionTrue(workspacev1.WorkspaceConditionBackupComplete) {
			// Beware: we apply the ContentFinalization timeout only to workspaces which are currently being deleted.
			//         We basically don't expect a workspace to be in content finalization before it's been deleted.
			return decide(ws.DeletionTimestamp.Time, timeouts.ContentFinalization, activityBackup)
		} else if !isWorkspaceBeingDeleted(ws) {
			// workspaces that have not been deleted have never timed out
			return ""
		} else {
			return decide(ws.DeletionTimestamp.Time, timeouts.Stopping, activityStopping)
		}

	default:
		// The only other phases we can be in is stopped which is pointless to time out
		return ""
	}
}

func (r *TimeoutReconciler) getMaxLifetime(ws *workspacev1.Workspace) util.Duration {
	if ws.Spec.Timeout.MaximumLifetime != nil {
		return util.Duration(ws.Spec.Timeout.MaximumLifetime.Duration)
	}

	return r.Config.Timeouts.MaxLifetime
}

func formatDuration(d time.Duration) string {
	d = d.Round(time.Minute)
	h := d / time.Hour
	d -= h * time.Hour
	m := d / time.Minute
	return fmt.Sprintf("%02dh%02dm", h, m)
}

// SetupWithManager sets up the controller with the Manager.
func (r *TimeoutReconciler) SetupWithManager(mgr ctrl.Manager) error {
	maxConcurrentReconciles := r.Config.TimeoutMaxConcurrentReconciles
	if maxConcurrentReconciles <= 0 {
		maxConcurrentReconciles = 1
	}

	return ctrl.NewControllerManagedBy(mgr).
		Named("timeout").
		WithOptions(controller.Options{MaxConcurrentReconciles: maxConcurrentReconciles}).
		For(&workspacev1.Workspace{}).
		Complete(r)
}
