// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/prometheus/client_golang/prometheus"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/source"
)

var (
	configMapKey = types.NamespacedName{Name: "ws-manager-mk2-maintenance-mode", Namespace: "default"}
	// lookupOnce is used for the first call to IsEnabled to load the maintenance mode state by looking
	// up the ConfigMap, as it's possible we haven't received a reconcile event yet to load its state.
	lookupOnce sync.Once
)

func NewMaintenanceReconciler(c client.Client, reg prometheus.Registerer) (*MaintenanceReconciler, error) {
	r := &MaintenanceReconciler{
		Client:       c,
		enabledUntil: nil,
	}

	gauge := newMaintenanceEnabledGauge(r)
	reg.MustRegister(gauge)

	return r, nil
}

type MaintenanceReconciler struct {
	client.Client

	enabledUntil *time.Time
}

func (r *MaintenanceReconciler) IsEnabled(ctx context.Context) bool {
	// On the first call, we load the maintenance mode state from the ConfigMap,
	// as it's possible we haven't reconciled it yet.
	lookupOnce.Do(func() {
		if err := r.loadFromCM(ctx, configMapKey); err != nil {
			log.FromContext(ctx).Error(err, "cannot load maintenance mode config")
		}
	})

	return r.enabledUntil != nil && time.Now().Before(*r.enabledUntil)
}

//+kubebuilder:rbac:groups=core,resources=configmap,verbs=get;list;watch

func (r *MaintenanceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	if req.Name != configMapKey.Name || req.Namespace != configMapKey.Namespace {
		// Ignore all other configmaps.
		return ctrl.Result{}, nil
	}

	return ctrl.Result{}, r.loadFromCM(ctx, req.NamespacedName)
}

func (r *MaintenanceReconciler) loadFromCM(ctx context.Context, key types.NamespacedName) error {
	log := log.FromContext(ctx)

	var cm corev1.ConfigMap
	if err := r.Get(ctx, key, &cm); err != nil {
		if errors.IsNotFound(err) {
			// ConfigMap does not exist, disable maintenance mode.
			r.setEnabledUntil(ctx, nil)
			return nil
		}

		log.Error(err, "unable to fetch configmap")
		return fmt.Errorf("failed to fetch configmap: %w", err)
	}

	configJson, ok := cm.Data["config.json"]
	if !ok {
		log.Info("missing config.json, setting maintenance mode as disabled")
		r.setEnabledUntil(ctx, nil)
		return nil
	}

	var cfg config.MaintenanceConfig
	if err := json.Unmarshal([]byte(configJson), &cfg); err != nil {
		log.Error(err, "failed to unmarshal maintenance config, setting maintenance mode as disabled")
		r.setEnabledUntil(ctx, nil)
		return nil
	}

	r.setEnabledUntil(ctx, cfg.EnabledUntil)
	return nil
}

func (r *MaintenanceReconciler) setEnabledUntil(ctx context.Context, enabledUntil *time.Time) {
	if enabledUntil == r.enabledUntil {
		// Nothing to do.
		return
	}

	r.enabledUntil = enabledUntil
	log.FromContext(ctx).Info("maintenance mode state change", "enabledUntil", enabledUntil)
}

func (r *MaintenanceReconciler) SetupWithManager(ctx context.Context, mgr ctrl.Manager) error {
	// We need to use an unmanaged controller to avoid issues when the pod is in standby mode.
	// In that scenario, the controllers are not started and don't watch changes and only
	// observe the maintenance mode during the initialization.
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

	return c.Watch(source.Kind(mgr.GetCache(), &corev1.ConfigMap{}, &handler.TypedEnqueueRequestForObject[*corev1.ConfigMap]{}, predicate.NewTypedPredicateFuncs(filterMaintenanceModeConfigMap)))
}

func filterMaintenanceModeConfigMap(obj *corev1.ConfigMap) bool {
	if obj == nil {
		return false
	}
	return obj.GetName() == configMapKey.Name && obj.GetNamespace() == configMapKey.Namespace
}
