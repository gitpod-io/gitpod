// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"

	"github.com/go-logr/logr"
	volumesnapshotv1 "github.com/kubernetes-csi/external-snapshotter/client/v4/apis/volumesnapshot/v1"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// VolumeSnapshotReconciler reconciles a VolumeSnapshot object
type VolumeSnapshotReconciler struct {
	client.Client
	Log    logr.Logger
	Scheme *runtime.Scheme

	Monitor *Monitor
}

// Reconcile performs a reconciliation of a volume snapshot
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.7.0/pkg/reconcile
func (r *VolumeSnapshotReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var vs volumesnapshotv1.VolumeSnapshot
	if err := r.Client.Get(context.Background(), req.NamespacedName, &vs); err != nil {
		if errors.IsNotFound(err) {
			// volume snapshot is gone - that's ok
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, xerrors.Errorf("error getting volume snapshot %s: %v", req.String(), err)
	}

	r.Monitor.eventpool.Add(vs.Name, watch.Event{
		Type:   watch.Modified,
		Object: &vs,
	})

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *VolumeSnapshotReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&volumesnapshotv1.VolumeSnapshot{}).
		Complete(r)
}
