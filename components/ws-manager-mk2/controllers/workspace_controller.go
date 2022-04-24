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
)

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

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
		pod, err := createPodForWorkspace(ctx, &workspace)
		if err != nil {
			log.Error(err, "unable to construct workspace pod")
			return ctrl.Result{Requeue: true}, err
		}

		err = r.Create(ctx, pod)
		if err != nil {
			log.Error(err, "unable to create Pod for Workspace", "pod", pod)
			return ctrl.Result{Requeue: true}, err
		}

		// we've just created a new pod and will want to update the status, hence the requeue
		return ctrl.Result{Requeue: true}, nil
	}

	return ctrl.Result{}, nil
}

func createPodForWorkspace(ctx context.Context, workspace *workspacev1.Workspace) (*corev1.Pod, error) {
	return &corev1.Pod{}, nil
}

func updateWorkspaceStatus(ctx context.Context, workspace *workspacev1.Workspace, pods corev1.PodList) error {
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
