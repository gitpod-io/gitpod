// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager-mk2/api/v1"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
)

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme

	Config config.Configuration
}

type WorkspacePodCreator func(ctx context.Context, ws *workspacev1.Workspace) (*corev1.Pod, error)

//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/finalizers,verbs=update
//+kubebuilder:rbac:groups=core,resources=pod,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=core,resources=pod/status,verbs=get

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
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
		// TODO(cw): create pdo
		log.Error(err, "unable to fetch workspace")
		// we'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	log.Info("reconciling workspace", "ws", req.NamespacedName)

	var workspacePods corev1.PodList
	if err := r.List(ctx, &workspacePods, client.InNamespace(req.Namespace), client.MatchingFields{wsOwnerKey: req.Name}); err != nil {
		log.Error(err, "unable to list child Jobs")
		return ctrl.Result{}, err
	}

	err := updateWorkspaceStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return ctrl.Result{}, err
	}

	// if there isn't a workspace pod and we're not currently deleting this workspace,
	// create one.
	if len(workspacePods.Items) == 0 {
		sctx, err := newStartWorkspaceContext(ctx, &r.Config, &workspace)
		if err != nil {
			log.Error(err, "unable to create startWorkspace context")
			return ctrl.Result{Requeue: true}, err
		}

		pod, err := r.createWorkspacePod(sctx)
		if err != nil {
			log.Error(err, "unable to produce workspace pod")
			return ctrl.Result{}, err
		}

		err = r.Create(ctx, pod)
		if err != nil {
			log.Error(err, "unable to create Pod for Workspace", "pod", pod)
			return ctrl.Result{Requeue: true}, err
		}
	}

	err = r.Status().Update(ctx, &workspace)
	if err != nil {
		log.Error(err, "unable to update workspace status")
		return ctrl.Result{Requeue: true}, err
	}

	return ctrl.Result{}, nil
}

func updateWorkspaceStatus(ctx context.Context, workspace *workspacev1.Workspace, pods corev1.PodList) error {
	switch len(pods.Items) {
	case 0:
		workspace.Status.Available = false
		return nil
	case 1:
		// continue below
	default:
		// This is exceptional - not sure what to do here. Probably fail the pod
		workspace.Status.Conditions.Failed = "multiple pods exists - this should never happen"
		return nil
	}

	workspace.Status.Conditions.Deployed = true

	return nil
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
