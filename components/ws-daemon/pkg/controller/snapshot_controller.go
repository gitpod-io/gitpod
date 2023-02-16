// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"

	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

// SnapshotReconciler reconciles a Snapshot object
type SnapshotReconciler struct {
	client.Client
	nodeName string
}

func NewSnapshotController(c client.Client, nodeName string) *SnapshotReconciler {
	return &SnapshotReconciler{
		Client:   c,
		nodeName: nodeName,
	}
}

// SetupWithManager sets up the controller with the Manager.
func (r *SnapshotReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&workspacev1.Snapshot{}).
		WithEventFilter(snapshotEventFilter(r.nodeName)).
		Complete(r)
}

func snapshotEventFilter(nodeName string) predicate.Predicate {
	return predicate.Funcs{
		CreateFunc: func(e event.CreateEvent) bool {
			if ss, ok := e.Object.(*workspacev1.Snapshot); ok {
				return ss.Spec.NodeName == nodeName
			}
			return false
		},
		UpdateFunc: func(ue event.UpdateEvent) bool {
			return false
		},
		DeleteFunc: func(de event.DeleteEvent) bool {
			return false
		},
	}
}

//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=snapshots,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=snapshots/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=snapshots/finalizers,verbs=update

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
// the Snapshot object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.14.1/pkg/reconcile
func (r *SnapshotReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	_ = log.FromContext(ctx)

	var snapshot workspacev1.Snapshot
	if err := r.Client.Get(ctx, req.NamespacedName, &snapshot); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	return ctrl.Result{}, nil
}
