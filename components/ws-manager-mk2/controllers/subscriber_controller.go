// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"os"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/record"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"

	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

func NewSubscriberReconciler(c client.Client, scheme *runtime.Scheme, recorder record.EventRecorder, cfg *config.Configuration) (*SubscriberReconciler, error) {
	reconciler := &SubscriberReconciler{
		Client:   c,
		Scheme:   scheme,
		Config:   cfg,
		Recorder: recorder,
	}

	return reconciler, nil
}

type SubscriberReconciler struct {
	client.Client
	Scheme *runtime.Scheme

	Config      *config.Configuration
	Recorder    record.EventRecorder
	OnReconcile func(ctx context.Context, ws *workspacev1.Workspace)
}

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// Modify the Reconcile function to compare the state specified by
// the Workspace object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.11.0/pkg/reconcile
func (r *SubscriberReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	if err := r.Get(ctx, req.NamespacedName, &workspace); err != nil {
		if !errors.IsNotFound(err) {
			log.Error(err, "unable to fetch workspace")
		}

		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if r.OnReconcile != nil {
		// Publish to subscribers in a goroutine, to prevent blocking the main reconcile loop.
		ws := workspace.DeepCopy()
		go func() {
			r.OnReconcile(ctx, ws)
		}()
	}

	return reconcile.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *SubscriberReconciler) SetupWithManager(ctx context.Context, mgr ctrl.Manager) error {
	c, err := controller.NewUnmanaged("maintenance-controller", mgr, controller.Options{Reconciler: r})
	if err != nil {
		return err
	}

	go func() {
		err = c.Start(ctx)
		if err != nil {
			log.FromContext(ctx).Error(err, "cannot start maintenance reconciler")
			os.Exit(1)
		}
	}()

	return c.Watch(source.Kind(mgr.GetCache(), &workspacev1.Workspace{}), &handler.EnqueueRequestForObject{})
}
