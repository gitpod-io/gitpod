// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"

	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

const gitpodioFinalizer = "gitpod.io/finalizer"

// ConfigmapReconciler reconciles a Configmap object
type ConfigmapReconciler struct {
	client.Client
	Log    logr.Logger
	Scheme *runtime.Scheme

	Monitor *Monitor
}

// Reconcile performs a reconciliation of a configmap
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.7.0/pkg/reconcile
func (r *ConfigmapReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var configmap corev1.ConfigMap
	err := r.Client.Get(ctx, req.NamespacedName, &configmap)
	if errors.IsNotFound(err) {
		return reconcile.Result{}, nil
	}

	/*
		isConfigmapMarkedToBeDeleted := configmap.GetDeletionTimestamp() != nil
		if isConfigmapMarkedToBeDeleted {
			if controllerutil.ContainsFinalizer(&configmap, gitpodioFinalizer) {
				// Run finalization logic for gitpodioFinalizer. If the
				// finalization logic fails, don't remove the finalizer so
				// that we can retry during the next reconciliation.
				if err := r.finalizeConfigmap(log, &configmap); err != nil {
					return ctrl.Result{}, err
				}

				// Remove gitpodioFinalizer. Once all finalizers have been
				// removed, the object will be deleted.
				controllerutil.RemoveFinalizer(&configmap, gitpodioFinalizer)
				err := r.Client.Update(ctx, &configmap)
				if err != nil {
					return ctrl.Result{}, err
				}
			}
			return ctrl.Result{}, nil
		}

		// Add finalizer for this configmap
		if !controllerutil.ContainsFinalizer(&configmap, gitpodioFinalizer) {
			controllerutil.AddFinalizer(&configmap, gitpodioFinalizer)
			err = r.Client.Update(ctx, &configmap)
			if err != nil {
				return ctrl.Result{}, err
			}
		}
	*/

	queue := configmap.Annotations[workspaceIDAnnotation]
	if queue == "" {
		return ctrl.Result{}, nil
	}

	r.Monitor.eventpool.Add(queue, watch.Event{
		Type:   watch.Modified,
		Object: &configmap,
	})

	return ctrl.Result{}, nil
}

func (r *ConfigmapReconciler) finalizeConfigmap(reqLogger logr.Logger, m *corev1.ConfigMap) error {
	reqLogger.Info("Successfully finalized")
	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *ConfigmapReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&corev1.ConfigMap{}).
		Complete(r)
}
