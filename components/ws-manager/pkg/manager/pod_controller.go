// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/util/workqueue"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/source"
)

// PodReconciler reconciles a Pod object
type PodReconciler struct {
	client.Client
	Log    logr.Logger
	Scheme *runtime.Scheme

	Monitor *Monitor
}

// Reconcile performs a reconciliation of a pod
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.7.0/pkg/reconcile
func (r *PodReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	return ctrl.Result{}, nil
}

type PodPoolFeeder struct {
	Eventpool interface {
		Add(queue string, evt watch.Event)
	}
}

func (e *PodPoolFeeder) add(tpe watch.EventType, obj runtime.Object) {
	if obj == nil {
		return
	}

	var queue string
	pod, ok := obj.(*corev1.Pod)
	if ok {
		queue = pod.Annotations[workspaceIDAnnotation]
	}
	if queue == "" {
		log.WithError(fmt.Errorf("event object has no name: %v", obj)).Error("cannot enqueue pod event")
		return
	}

	e.Eventpool.Add(queue, watch.Event{Type: tpe, Object: obj})
}

// Create implements EventHandler
func (e *PodPoolFeeder) Create(evt event.CreateEvent, q workqueue.RateLimitingInterface) {
	e.add(watch.Added, evt.Object)
}

// Update implements EventHandler
func (e *PodPoolFeeder) Update(evt event.UpdateEvent, q workqueue.RateLimitingInterface) {
	e.add(watch.Modified, evt.ObjectNew)
}

// Delete implements EventHandler
func (e *PodPoolFeeder) Delete(evt event.DeleteEvent, q workqueue.RateLimitingInterface) {
	e.add(watch.Deleted, evt.Object)
}

// Generic implements EventHandler
func (e *PodPoolFeeder) Generic(evt event.GenericEvent, q workqueue.RateLimitingInterface) {
	// TODO(cw): figure out what to do here
}

// SetupWithManager sets up the controller with the Manager.
func (r *PodReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Pod{}).
		Watches(&source.Kind{Type: &corev1.Pod{}}, &PodPoolFeeder{
			Eventpool: r.Monitor.eventpool,
		}).
		Complete(r)
}
