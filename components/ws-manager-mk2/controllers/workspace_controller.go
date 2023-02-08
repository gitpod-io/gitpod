// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/prometheus/client_golang/prometheus"
)

type modifyWorkspace func(ws *workspacev1.Workspace) error

var retryParams = wait.Backoff{
	Steps:    6,
	Duration: 10 * time.Millisecond,
	Factor:   2.0,
	Jitter:   0.2,
}

const (
	metricsNamespace          = "gitpod"
	metricsWorkspaceSubsystem = "ws_manager_mk2"
	// kubernetesOperationTimeout is the time we give Kubernetes operations in general.
	kubernetesOperationTimeout = 5 * time.Second
)

func NewWorkspaceReconciler(c client.Client, scheme *runtime.Scheme, cfg config.Configuration, reg prometheus.Registerer) (*WorkspaceReconciler, error) {
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

	Config      config.Configuration
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

	err = updateWorkspaceStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return ctrl.Result{}, err
	}

	r.updateMetrics(ctx, &workspace)

	result, mod, err := r.actOnStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return result, err
	}

	err = r.modifyWorkspace(ctx, workspace.Name, true, mod)
	if err != nil {
		log.WithValues("status", workspace.Status).Error(err, "unable to update workspace status")
		return ctrl.Result{Requeue: true}, err
	}

	if r.OnReconcile != nil {
		r.OnReconcile(ctx, &workspace)
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) actOnStatus(ctx context.Context, workspace *workspacev1.Workspace, workspacePods corev1.PodList) (ctrl.Result, modifyWorkspace, error) {
	log := log.FromContext(ctx)
	var mod modifyWorkspace

	if len(workspacePods.Items) == 0 {
		// if there isn't a workspace pod and we're not currently deleting this workspace,// create one.
		switch {
		case workspace.Status.PodStarts == 0:
			sctx, err := newStartWorkspaceContext(ctx, &r.Config, workspace)
			if err != nil {
				log.Error(err, "unable to create startWorkspace context")
				return ctrl.Result{Requeue: true}, mod, err
			}

			pod, err := r.createWorkspacePod(sctx)
			if err != nil {
				log.Error(err, "unable to produce workspace pod")
				return ctrl.Result{}, mod, err
			}

			if err := ctrl.SetControllerReference(workspace, pod, r.Scheme); err != nil {
				return ctrl.Result{}, mod, err
			}

			err = r.Create(ctx, pod)
			if errors.IsAlreadyExists(err) {
				// pod exists, we're good
			} else if err != nil {
				log.Error(err, "unable to create Pod for Workspace", "pod", pod)
				return ctrl.Result{Requeue: true}, mod, err
			} else {
				mod = func(ws *workspacev1.Workspace) error {
					ws.Status.PodStarts = 1
					return nil
				}
			}
			r.metrics.rememberWorkspace(workspace)

		case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
			err := r.Client.Delete(ctx, workspace)
			if err != nil {
				return ctrl.Result{Requeue: true}, mod, err
			}
		}

		return ctrl.Result{}, mod, nil
	}

	// all actions below assume there is a pod
	if len(workspacePods.Items) == 0 {
		return ctrl.Result{}, mod, nil
	}
	pod := &workspacePods.Items[0]

	switch {
	// if there is a pod, and it's failed, delete it
	case wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)) && !isPodBeingDeleted(pod):
		err := r.Client.Delete(ctx, pod)
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, mod, err
		}

	// if the pod was stopped by request, delete it
	case wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionStoppedByRequest)) && !isPodBeingDeleted(pod):
		err := r.Client.Delete(ctx, pod)
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, mod, err
		}

	// if the content initialization failed, delete the pod
	case wsk8s.ConditionWithStatusAndReason(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, "InitializationFailure") && !isPodBeingDeleted(pod):
		err := r.Client.Delete(ctx, pod)
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, mod, err
		}

	// we've disposed already - try to remove the finalizer and call it a day
	case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
		var foundFinalizer bool
		n := 0
		for _, x := range pod.Finalizers {
			if x != gitpodPodFinalizerName {
				pod.Finalizers[n] = x
				n++
			} else {
				foundFinalizer = true
			}
		}
		pod.Finalizers = pod.Finalizers[:n]
		err := r.Client.Update(ctx, pod)
		if err != nil {
			return ctrl.Result{Requeue: true}, mod, err
		}

		if foundFinalizer {
			// reque to remove workspace
			return ctrl.Result{RequeueAfter: 10 * time.Second}, mod, nil
		}
	}

	return ctrl.Result{}, mod, nil
}

func (r *WorkspaceReconciler) updateMetrics(ctx context.Context, workspace *workspacev1.Workspace) {
	log := log.FromContext(ctx)

	phase := workspace.Status.Phase

	if !r.metrics.shouldUpdate(&log, workspace) {
		return
	}

	switch {
	case phase == workspacev1.WorkspacePhasePending ||
		phase == workspacev1.WorkspacePhaseCreating ||
		phase == workspacev1.WorkspacePhaseInitializing:

		if wsk8s.ConditionWithStatusAndReason(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, "InitializationFailure") {
			r.metrics.countTotalRestoreFailures(&log, workspace)
			r.metrics.countWorkspaceStartFailures(&log, workspace)
		}

		if wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)) {
			r.metrics.countWorkspaceStartFailures(&log, workspace)
		}

	case phase == workspacev1.WorkspacePhaseRunning:
		r.metrics.recordWorkspaceStartupTime(&log, workspace)
		if wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)) {
			r.metrics.countTotalRestores(&log, workspace)
		}

	case phase == workspacev1.WorkspacePhaseStopped:
		if wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionBackupFailure)) {
			r.metrics.countTotalBackups(&log, workspace)
			r.metrics.countTotalBackupFailures(&log, workspace)
		}

		if wsk8s.ConditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionBackupComplete)) {
			r.metrics.countTotalBackups(&log, workspace)
		}

		r.metrics.countWorkspaceStop(&log, workspace)
		r.metrics.forgetWorkspace(workspace)
		return
	}

	r.metrics.rememberWorkspace(workspace)
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
		For(&workspacev1.Workspace{}).
		Owns(&corev1.Pod{}).
		Complete(r)
}

// modifyWorkspace modifies a workspace object using the mod function. If the mod function returns a gRPC status error, that error
// is returned directly. If mod returns a non-gRPC error it is turned into one.
func (r *WorkspaceReconciler) modifyWorkspace(ctx context.Context, id string, updateStatus bool, mods ...func(ws *workspacev1.Workspace) error) error {
	err := retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		var ws workspacev1.Workspace
		err := r.Get(ctx, types.NamespacedName{Namespace: "default", Name: id}, &ws)
		if err != nil {
			return err
		}

		for _, mod := range mods {
			err = mod(&ws)
			if err != nil {
				return err
			}
		}

		if updateStatus {
			err = r.Status().Update(ctx, &ws)
		} else {
			err = r.Update(ctx, &ws)

		}
		return err
	})
	if errors.IsNotFound(err) {
		return fmt.Errorf("workspace %s not found", id)
	}
	if c := status.Code(err); c != codes.Unknown && c != codes.OK {
		return err
	}
	if err != nil {
		return status.Errorf(codes.Internal, "cannot modify workspace: %v", err)
	}
	return nil
}
