// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package manager

import (
	"context"

	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// PodReconciler reconciles a Pod object
type PodReconciler struct {
	client.Client
	Log    logr.Logger
	Scheme *runtime.Scheme

	Monitor *Monitor
	Pods    map[types.NamespacedName]corev1.Pod
}

// Reconcile performs a reconciliation of a pod
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.7.0/pkg/reconcile
func (r *PodReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var pod corev1.Pod
	err := r.Client.Get(context.Background(), req.NamespacedName, &pod)
	if errors.IsNotFound(err) {
		// pod is gone - that's ok
		if pod, ok := r.Pods[req.NamespacedName]; ok {
			delete(r.Pods, req.NamespacedName)
			queue := pod.Annotations[workspaceIDAnnotation]
			if queue == "" {
				return ctrl.Result{}, nil
			}
			r.Monitor.eventpool.Add(queue, watch.Event{
				Type:   watch.Deleted,
				Object: &pod,
			})
		}
		return reconcile.Result{}, nil
	}
	r.Pods[req.NamespacedName] = pod

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

// SetupWithManager sets up the controller with the Manager.
func (r *PodReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Pod{}).
		Complete(r)
}
