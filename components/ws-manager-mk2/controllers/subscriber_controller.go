// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"os"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/source"

	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/constants"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"

	k8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
)

func NewSubscriberReconciler(c client.Client, cfg *config.Configuration) (*SubscriberReconciler, error) {
	reconciler := &SubscriberReconciler{
		Client: c,
		Config: cfg,
	}

	return reconciler, nil
}

type SubscriberReconciler struct {
	client.Client

	Config *config.Configuration

	OnReconcile func(ctx context.Context, ws *workspacev1.Workspace)
}

func (r *SubscriberReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	if err := r.Get(ctx, req.NamespacedName, &workspace); err != nil {
		if !errors.IsNotFound(err) {
			log.Error(err, "unable to fetch workspace")
		}

		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if workspace.Status.Conditions == nil {
		workspace.Status.Conditions = []metav1.Condition{}
	}

	if r.OnReconcile != nil {
		r.OnReconcile(ctx, &workspace)
	}

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *SubscriberReconciler) SetupWithManager(ctx context.Context, mgr ctrl.Manager) error {
	c, err := controller.NewUnmanaged("subscribers-controller", mgr, controller.Options{Reconciler: r})
	if err != nil {
		return err
	}

	go func() {
		err = c.Start(ctx)
		if err != nil {
			log.FromContext(ctx).Error(err, "cannot start Subscriber reconciler")
			os.Exit(1)
		}
	}()

	filterByManagedBy := func(ws *workspacev1.Workspace) bool {
		mgr, ok := ws.Labels[k8s.WorkspaceManagedByLabel]
		if !ok {
			return true
		}

		return mgr == constants.ManagedBy
	}

	// we need several reconciliation loops during a workspace creation until it reaches a stable state.
	// this introduces the side effect of multiple notifications to the subscribers with partial information.
	// the filterByUpdate predicate acts as a filter to avoid this
	filterByUpdate := predicate.Funcs{
		CreateFunc: func(ce event.CreateEvent) bool {
			ws := ce.Object.(*workspacev1.Workspace)
			return filterByManagedBy(ws)
		},
		UpdateFunc: func(e event.UpdateEvent) bool {
			old := e.ObjectOld.(*workspacev1.Workspace)
			new := e.ObjectNew.(*workspacev1.Workspace)

			mgr, ok := new.Labels[k8s.WorkspaceManagedByLabel]
			if !ok {
				return true
			}

			if mgr != constants.ManagedBy {
				return false
			}

			if !cmp.Equal(old.Spec.Ports, new.Spec.Ports) {
				return true
			}

			return !cmp.Equal(old.Status, new.Status, cmpopts.IgnoreFields(workspacev1.WorkspaceStatus{}, "LastActivity"))
		},

		DeleteFunc: func(de event.DeleteEvent) bool {
			ws := de.Object.(*workspacev1.Workspace)
			return filterByManagedBy(ws)
		},
	}

	return c.Watch(source.Kind(mgr.GetCache(), &workspacev1.Workspace{}), &handler.EnqueueRequestForObject{}, filterByUpdate)
}
