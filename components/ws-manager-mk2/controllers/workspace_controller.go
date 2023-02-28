// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace          = "gitpod"
	metricsWorkspaceSubsystem = "ws_manager_mk2"
	// kubernetesOperationTimeout is the time we give Kubernetes operations in general.
	kubernetesOperationTimeout = 5 * time.Second
)

func NewWorkspaceReconciler(c client.Client, scheme *runtime.Scheme, cfg *config.Configuration, reg prometheus.Registerer) (*WorkspaceReconciler, error) {
	reconciler := &WorkspaceReconciler{
		Client: c,
		Scheme: scheme,
		Config: cfg,
	}

	metrics, err := newControllerMetrics(reconciler)
	if err != nil {
		return nil, err
	}
	reg.MustRegister(metrics)
	reconciler.metrics = metrics

	return reconciler, nil
}

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme

	Config      *config.Configuration
	metrics     *controllerMetrics
	OnReconcile func(ctx context.Context, ws *workspacev1.Workspace)
}

//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/finalizers,verbs=update
//+kubebuilder:rbac:groups=core,resources=pod,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=core,resources=pod/status,verbs=get

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// Modify the Reconcile function to compare the state specified by
// the Workspace object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.11.0/pkg/reconcile
func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	if err := r.Get(ctx, req.NamespacedName, &workspace); err != nil {
		if !errors.IsNotFound(err) {
			log.Error(err, "unable to fetch workspace")
		}
		// we'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if workspace.Status.Conditions == nil {
		workspace.Status.Conditions = []metav1.Condition{}
	}

	log.Info("reconciling workspace", "ws", req.NamespacedName)

	var workspacePods corev1.PodList
	err := r.List(ctx, &workspacePods, client.InNamespace(req.Namespace), client.MatchingFields{wsOwnerKey: req.Name})
	if err != nil {
		log.Error(err, "unable to list workspace pods")
		return ctrl.Result{}, err
	}

	err = updateWorkspaceStatus(ctx, &workspace, workspacePods, r.Config)
	if err != nil {
		return ctrl.Result{}, err
	}

	r.updateMetrics(ctx, &workspace)

	err = r.Status().Update(ctx, &workspace)
	if err != nil {
		// log.WithValues("status", workspace).Error(err, "unable to update workspace status")
		return ctrl.Result{Requeue: true}, err
	}

	result, err := r.actOnStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return result, err
	}

	if r.OnReconcile != nil {
		r.OnReconcile(ctx, &workspace)
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) actOnStatus(ctx context.Context, workspace *workspacev1.Workspace, workspacePods corev1.PodList) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	if len(workspacePods.Items) == 0 {
		// if there isn't a workspace pod and we're not currently deleting this workspace,// create one.
		switch {
		case workspace.Status.PodStarts == 0:
			sctx, err := newStartWorkspaceContext(ctx, r.Config, workspace)
			if err != nil {
				log.Error(err, "unable to create startWorkspace context")
				return ctrl.Result{Requeue: true}, err
			}

			pod, err := r.createWorkspacePod(sctx)
			if err != nil {
				log.Error(err, "unable to produce workspace pod")
				return ctrl.Result{}, err
			}

			if err := ctrl.SetControllerReference(workspace, pod, r.Scheme); err != nil {
				return ctrl.Result{}, err
			}

			log.Info("creating workspace Pod for Workspace")
			err = r.Create(ctx, pod)
			if errors.IsAlreadyExists(err) {
				// pod exists, we're good
				log.Info("Workspace Pod already exists")
			} else if err != nil {
				log.Error(err, "unable to create Pod for Workspace", "pod", pod)
				return ctrl.Result{Requeue: true}, err
			} else {
				// TODO(cw): replicate the startup mechanism where pods can fail to be scheduled,
				//			 need to be deleted and re-created
				// Must increment and persist the pod starts, and ensure we retry on conflict.
				// If we fail to persist this value, it's possible that the Pod gets recreated
				// when the workspace stops, due to PodStarts still being 0 when the original Pod
				// disappears.
				// Use a Patch instead of an Update, to prevent conflicts.
				patch := client.MergeFrom(workspace.DeepCopy())
				workspace.Status.PodStarts++
				if err := r.Status().Patch(ctx, workspace, patch); err != nil {
					log.Error(err, "Failed to patch PodStarts in workspace status")
					return ctrl.Result{}, err
				}
			}
			r.metrics.rememberWorkspace(workspace, nil)

		case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
			// Done stopping workspace - remove finalizer.
			if controllerutil.ContainsFinalizer(workspace, workspacev1.GitpodFinalizerName) {
				controllerutil.RemoveFinalizer(workspace, workspacev1.GitpodFinalizerName)
				if err := r.Update(ctx, workspace); err != nil {
					return ctrl.Result{}, client.IgnoreNotFound(err)
				}
			}

			// Workspace might have already been in a deleting state,
			// but not guaranteed, so try deleting anyway.
			err := r.Client.Delete(ctx, workspace)
			return ctrl.Result{}, client.IgnoreNotFound(err)
		}

		return ctrl.Result{}, nil
	}

	// all actions below assume there is a pod
	if len(workspacePods.Items) == 0 {
		return ctrl.Result{}, nil
	}
	pod := &workspacePods.Items[0]

	switch {
	// if there is a pod, and it's failed, delete it
	case wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "workspace failed")

	// if the pod was stopped by request, delete it
	case wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionStoppedByRequest)) && !isPodBeingDeleted(pod):
		var gracePeriodSeconds *int64
		if c := wsk8s.GetCondition(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionStoppedByRequest)); c != nil {
			if dt, err := time.ParseDuration(c.Message); err == nil {
				s := int64(dt.Seconds())
				gracePeriodSeconds = &s
			}
		}
		err := r.Client.Delete(ctx, pod, &client.DeleteOptions{
			GracePeriodSeconds: gracePeriodSeconds,
		})
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, err
		}

	// if the workspace timed out, delete it
	case wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionTimeout)) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "timed out")

	// if the content initialization failed, delete the pod
	case wsk8s.ConditionWithStatusAndReason(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, "InitializationFailure") && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "init failed")

	case isWorkspaceBeingDeleted(workspace) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "workspace deleted")

	case workspace.IsHeadless() && workspace.Status.Phase == workspacev1.WorkspacePhaseStopped && !isPodBeingDeleted(pod):
		// Workspace was requested to be deleted, propagate by deleting the Pod.
		// The Pod deletion will then trigger workspace disposal steps.
		err := r.Client.Delete(ctx, pod)
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, err
		}

	// we've disposed already - try to remove the finalizer and call it a day
	case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
		hadFinalizer := controllerutil.ContainsFinalizer(pod, workspacev1.GitpodFinalizerName)
		controllerutil.RemoveFinalizer(pod, workspacev1.GitpodFinalizerName)
		if err := r.Client.Update(ctx, pod); err != nil {
			return ctrl.Result{}, fmt.Errorf("failed to remove gitpod finalizer: %w", err)
		}

		if hadFinalizer {
			// Requeue to remove workspace.
			return ctrl.Result{RequeueAfter: 10 * time.Second}, nil
		}
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) updateMetrics(ctx context.Context, workspace *workspacev1.Workspace) {
	log := log.FromContext(ctx)

	ok, lastState := r.metrics.getWorkspace(&log, workspace)
	if !ok {
		return
	}

	if !lastState.recordedInitFailure && wsk8s.ConditionWithStatusAndReason(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, "InitializationFailure") {
		r.metrics.countTotalRestoreFailures(&log, workspace)
		lastState.recordedInitFailure = true

		if !lastState.recordedStartFailure {
			r.metrics.countWorkspaceStartFailures(&log, workspace)
			lastState.recordedStartFailure = true
		}
	}

	if !lastState.recordedStartFailure && wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)) {
		// Only record if there was no other start failure recorded yet, to ensure max one
		// start failure gets recorded per workspace.
		r.metrics.countWorkspaceStartFailures(&log, workspace)
		lastState.recordedStartFailure = true
	}

	if !lastState.recordedContentReady && wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)) {
		r.metrics.countTotalRestores(&log, workspace)
		lastState.recordedContentReady = true
	}

	if !lastState.recordedBackupFailed && wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionBackupFailure)) {
		r.metrics.countTotalBackups(&log, workspace)
		r.metrics.countTotalBackupFailures(&log, workspace)
		lastState.recordedBackupFailed = true
	}

	if !lastState.recordedBackupCompleted && wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionBackupComplete)) {
		r.metrics.countTotalBackups(&log, workspace)
		lastState.recordedBackupCompleted = true
	}

	if !lastState.recordedStartTime && workspace.Status.Phase == workspacev1.WorkspacePhaseRunning {
		r.metrics.recordWorkspaceStartupTime(&log, workspace)
		lastState.recordedStartTime = true
	}

	if workspace.Status.Phase == workspacev1.WorkspacePhaseStopped {
		r.metrics.countWorkspaceStop(&log, workspace)

		// Forget about this workspace, no more state updates will be recorded after this.
		r.metrics.forgetWorkspace(workspace)
		return
	}

	r.metrics.rememberWorkspace(workspace, &lastState)
}

func (r *WorkspaceReconciler) deleteWorkspacePod(ctx context.Context, pod *corev1.Pod, reason string) (ctrl.Result, error) {
	log := log.FromContext(ctx).WithValues("workspace", pod.Name, "reason", reason)
	log.V(1).Info("deleting workspace pod")

	// Workspace was requested to be deleted, propagate by deleting the Pod.
	// The Pod deletion will then trigger workspace disposal steps.
	err := r.Client.Delete(ctx, pod)
	if errors.IsNotFound(err) {
		// pod is gone - nothing to do here
	} else {
		return ctrl.Result{Requeue: true}, err
	}

	return ctrl.Result{}, nil
}

var (
	wsOwnerKey = ".metadata.controller"
	apiGVStr   = workspacev1.GroupVersion.String()
)

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	idx := func(rawObj client.Object) []string {
		// grab the job object, extract the owner...
		job := rawObj.(*corev1.Pod)
		owner := metav1.GetControllerOf(job)
		if owner == nil {
			return nil
		}
		// ...make sure it's a workspace...
		if owner.APIVersion != apiGVStr || owner.Kind != "Workspace" {
			return nil
		}

		// ...and if so, return it
		return []string{owner.Name}
	}
	err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Pod{}, wsOwnerKey, idx)
	if err != nil {
		return err
	}

	return ctrl.NewControllerManagedBy(mgr).
		Named("workspace").
		WithOptions(controller.Options{
			MaxConcurrentReconciles: r.Config.WorkspaceMaxConcurrentReconciles,
		}).
		For(&workspacev1.Workspace{}).
		Owns(&corev1.Pod{}).
		Complete(r)
}
