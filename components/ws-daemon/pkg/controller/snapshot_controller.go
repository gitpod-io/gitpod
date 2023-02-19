// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"fmt"

	"k8s.io/client-go/util/retry"
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
	nodeName   string
	operations *WorkspaceOperations
}

func NewSnapshotController(c client.Client, nodeName string, wso *WorkspaceOperations) *SnapshotReconciler {
	return &SnapshotReconciler{
		Client:     c,
		nodeName:   nodeName,
		operations: wso,
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
func (ssc *SnapshotReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var snapshot workspacev1.Snapshot
	if err := ssc.Client.Get(ctx, req.NamespacedName, &snapshot); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if snapshot.Status.Completed {
		return ctrl.Result{}, nil
	}

	snapshotURL, snapshotName, snapshotErr := ssc.operations.SnapshotIDs(snapshot.Spec.WorkspaceID)
	if snapshotErr != nil {
		return ctrl.Result{}, snapshotErr
	}

	err := retry.RetryOnConflict(retryParams, func() error {
		err := ssc.Client.Get(ctx, req.NamespacedName, &snapshot)
		if err != nil {
			return err
		}

		snapshot.Status.URL = snapshotURL
		return ssc.Client.Status().Update(ctx, &snapshot)
	})

	if err != nil {
		log.Error(err, "could not set snapshot url", "workspace", snapshot.Spec.WorkspaceID)
		return ctrl.Result{}, err
	}

	snapshotErr = ssc.operations.TakeSnapshot(ctx, snapshot.Spec.WorkspaceID, snapshotName)
	err = retry.RetryOnConflict(retryParams, func() error {
		err := ssc.Client.Get(ctx, req.NamespacedName, &snapshot)
		if err != nil {
			return err
		}

		snapshot.Status.Completed = true
		if snapshotErr != nil {
			snapshot.Status.Error = fmt.Errorf("could not take snapshot: %w", snapshotErr).Error()
		}

		return ssc.Status().Update(ctx, &snapshot)
	})

	if err != nil {
		log.Error(err, "could not set completion status for snapshot", "workspace", snapshot.Spec.WorkspaceID)
	}

	return ctrl.Result{}, err
}
