// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	// Import all Kubernetes client auth plugins (e.g. Azure, GCP, OIDC, etc.)
	// to ensure that exec-entrypoint and run can make use of them.
	_ "k8s.io/client-go/plugin/pkg/client/auth"

	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager-mk2/api/v1"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/controllers"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	//+kubebuilder:scaffold:imports
)

var (
	scheme   = runtime.NewScheme()
	setupLog = ctrl.Log.WithName("setup")
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))

	utilruntime.Must(workspacev1.AddToScheme(scheme))
	//+kubebuilder:scaffold:scheme
}

func main() {

	var metricsAddr string
	var enableLeaderElection bool
	var probeAddr string
	var configFN string
	flag.StringVar(&metricsAddr, "metrics-bind-address", ":8080", "The address the metric endpoint binds to.")
	flag.StringVar(&probeAddr, "health-probe-bind-address", ":8081", "The address the probe endpoint binds to.")
	flag.BoolVar(&enableLeaderElection, "leader-elect", false,
		"Enable leader election for controller manager. "+
			"Enabling this will ensure there is only one active controller manager.")
	flag.StringVar(&configFN, "config", "", "Path to the config file")
	opts := zap.Options{
		Development: true,
	}
	opts.BindFlags(flag.CommandLine)
	flag.Parse()

	ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))

	cfg, err := getConfig(configFN)
	if err != nil {
		setupLog.Error(err, "unable to read config")
		os.Exit(1)
	}

	mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
		Scheme:                 scheme,
		MetricsBindAddress:     metricsAddr,
		Port:                   9443,
		HealthProbeBindAddress: probeAddr,
		LeaderElection:         enableLeaderElection,
		LeaderElectionID:       "0616d21e.gitpod.io",
	})
	if err != nil {
		setupLog.Error(err, "unable to start manager")
		os.Exit(1)
	}

	if err = (&controllers.WorkspaceReconciler{
		Client: mgr.GetClient(),
		Scheme: mgr.GetScheme(),
		Config: cfg.Manager,
	}).SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "Workspace")
		os.Exit(1)
	}
	// if err = (&workspacev1.Workspace{}).SetupWebhookWithManager(mgr); err != nil {
	// 	setupLog.Error(err, "unable to create webhook", "webhook", "Workspace")
	// 	os.Exit(1)
	// }
	//+kubebuilder:scaffold:builder

	if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up health check")
		os.Exit(1)
	}
	if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up ready check")
		os.Exit(1)
	}

	setupLog.Info("starting manager")
	if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
		setupLog.Error(err, "problem running manager")
		os.Exit(1)
	}
}

func getConfig(fn string) (*config.ServiceConfiguration, error) {
	ctnt, err := os.ReadFile(fn)
	if err != nil {
		return nil, fmt.Errorf("cannot read configuration. Maybe missing --config?: %w", err)
	}

	var cfg config.ServiceConfiguration
	dec := json.NewDecoder(bytes.NewReader(ctnt))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		return nil, fmt.Errorf("cannot decode configuration from %s: %w", fn, err)
	}

	return &cfg, nil
}
