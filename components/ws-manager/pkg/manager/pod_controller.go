// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// PodReconciler reconciles a Pod object
type PodReconciler struct {
	client.Client
	Scheme *runtime.Scheme

	Monitor *Monitor
}

// Reconcile performs a reconciliation of a pod
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.7.0/pkg/reconcile
func (r *PodReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var pod corev1.Pod
	err := r.Client.Get(ctx, req.NamespacedName, &pod)
	if errors.IsNotFound(err) {
		// Nothing to do. Pod deleted.
		return reconcile.Result{}, nil
	}

	isPodMarkedToBeDeleted := pod.GetDeletionTimestamp() != nil
	if isPodMarkedToBeDeleted {
		if controllerutil.ContainsFinalizer(&pod, gitpodioFinalizer) {
			// Run finalization logic for gitpodioFinalizer. If the
			// finalization logic fails, don't remove the finalizer so
			// that we can retry during the next reconciliation.
			if err := r.finalizePod(&pod); err != nil {
				return ctrl.Result{}, err
			}

			// Remove gitpodioFinalizer. Once all finalizers have been
			// removed, the object will be deleted.
			controllerutil.RemoveFinalizer(&pod, gitpodioFinalizer)
			err := r.Client.Update(ctx, &pod)
			if err != nil {
				return ctrl.Result{}, err
			}
		}
		return ctrl.Result{}, nil
	}

	// Add finalizer for this pod
	if !controllerutil.ContainsFinalizer(&pod, gitpodioFinalizer) && wsk8s.IsWorkspace(&pod) {
		controllerutil.AddFinalizer(&pod, gitpodioFinalizer)
		err = r.Client.Update(ctx, &pod)
		if err != nil {
			return ctrl.Result{}, err
		}
	}

	queue := pod.Annotations[workspaceIDAnnotation]
	if queue == "" {
		return ctrl.Result{}, nil
	}

	r.Monitor.eventpool.Add(queue, watch.Event{
		Type:   watch.Modified,
		Object: &pod,
	})

	return ctrl.Result{}, nil
}

func (r *PodReconciler) finalizePod(pod *corev1.Pod) error {
	owi := wsk8s.GetOWIFromObject(&pod.ObjectMeta)
	clog := log.WithFields(owi)

	queue := pod.Annotations[workspaceIDAnnotation]
	if queue == "" {
		return nil
	}

	r.Monitor.eventpool.Add(queue, watch.Event{
		Type:   watch.Deleted,
		Object: pod,
	})

	clog.Info("Successfully finalized")

	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *PodReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Pod{}).
		Complete(r)
}
