// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"encoding/json"
	"time"

	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

const (
	LabelMaintenance = "gitpod.io/maintenanceConfig"
	configMapName    = "ws-manager-mk2-maintenance-mode"
)

var (
	indefinite = time.Now().Add(999999 * time.Hour)
)

func NewMaintenanceReconciler(c client.Client) (*MaintenanceReconciler, error) {
	return &MaintenanceReconciler{
		Client: c,
		// Enable maintenance by default, until we observe the ConfigMap with the actual value.
		// Prevents a race on startup where the workspace reconciler might run before
		// we observe the maintenance mode ConfigMap. Better be safe and prevent
		// reconciliation of that workspace until it's certain maintenance mode is
		// not enabled.
		enabledUntil: &indefinite,
	}, nil
}

type MaintenanceReconciler struct {
	client.Client

	enabledUntil *time.Time
}

func (r *MaintenanceReconciler) IsEnabled() bool {
	return r.enabledUntil != nil && time.Now().Before(*r.enabledUntil)
}

//+kubebuilder:rbac:groups=core,resources=configmap,verbs=get;list;watch

func (r *MaintenanceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx).WithValues("configMap", req.NamespacedName)

	if req.Name != configMapName {
		return ctrl.Result{}, nil
	}

	var cm corev1.ConfigMap
	if err := r.Get(ctx, req.NamespacedName, &cm); err != nil {
		if errors.IsNotFound(err) {
			// ConfigMap does not exist, disable maintenance mode.
			r.setEnabledUntil(log, nil)
			return ctrl.Result{}, nil
		}

		log.Error(err, "unable to fetch configmap")
		return ctrl.Result{}, err
	}

	configJson, ok := cm.Data["config.json"]
	if !ok {
		log.Info("missing config.json, setting maintenance mode as disabled")
		r.setEnabledUntil(log, nil)
		return ctrl.Result{}, nil
	}

	var cfg config.MaintenanceConfig
	if err := json.Unmarshal([]byte(configJson), &cfg); err != nil {
		log.Error(err, "failed to unmarshal maintenance config, setting maintenance mode as disabled")
		r.setEnabledUntil(log, nil)
		return ctrl.Result{}, nil
	}

	r.setEnabledUntil(log, cfg.EnabledUntil)
	return ctrl.Result{}, nil
}

func (r *MaintenanceReconciler) setEnabledUntil(log logr.Logger, enabledUntil *time.Time) {
	if enabledUntil == r.enabledUntil {
		// Nothing to do.
		return
	}

	r.enabledUntil = enabledUntil
	log.Info("maintenance mode state change", "enabled", r.IsEnabled(), "enabledUntil", enabledUntil)
}

func (r *MaintenanceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		Named("maintenance").
		// The controller manager filters watch events only to ConfigMaps with the LabelMaintenance label set to "true".
		// See components/ws-manager-mk2/main.go's NewCache function in the manager options.
		For(&corev1.ConfigMap{}).
		Complete(r)
}
