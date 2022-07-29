// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"

	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/predicate"

	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/grpcpool"
)

// WSDaemonReconciler reconciles ws-daemon pods
type WSDaemonReconciler struct {
	client.Client
	Log    logr.Logger
	Scheme *runtime.Scheme

	WSDaemonPool *grpcpool.Pool
}

func (r *WSDaemonReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var pod corev1.Pod
	err := r.Client.Get(ctx, req.NamespacedName, &pod)
	if err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if !pod.DeletionTimestamp.IsZero() {
		err := r.WSDaemonPool.Remove(pod.Spec.NodeName)
		if err != nil {
			return ctrl.Result{}, err
		}

		return ctrl.Result{}, nil
	}

	// wait until ws-daemon pod is scheduled and running with a valid IP address
	if pod.Spec.NodeName == "" || pod.Status.PodIP == "" {
		return ctrl.Result{}, nil
	}

	err = r.WSDaemonPool.Add(pod.Spec.NodeName, pod.Status.PodIP)
	if err != nil {
		r.Log.Error(err, "cannot add host to ws-daemon connection pool")
	}

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *WSDaemonReconciler) SetupWithManager(mgr ctrl.Manager, namespace string) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Pod{}, builder.WithPredicates(
			inNamespace(namespace),
			isWsdaemon,
		)).
		Complete(r)
}

var inNamespace = func(namespace string) predicate.Predicate {
	return predicate.NewPredicateFuncs(func(obj client.Object) bool {
		if namespace == "" {
			namespace = corev1.NamespaceDefault
		}

		return namespace == obj.GetNamespace()
	})
}

var isWsdaemon = predicate.NewPredicateFuncs(func(obj client.Object) bool {
	app, ok := obj.GetLabels()["app"]
	if !ok {
		return false
	}

	component, ok := obj.GetLabels()["component"]
	if !ok {
		return false
	}

	return app == "gitpod" && component == "ws-daemon"
})
