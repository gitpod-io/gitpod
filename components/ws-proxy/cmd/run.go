// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/bombsimon/logrusr/v2"
	"github.com/spf13/cobra"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/config"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
)

var (
	jsonLog bool
	verbose bool
)

// runCmd represents the run command.
var runCmd = &cobra.Command{
	Use:   "run <config.json>",
	Short: "Starts ws-proxy",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.GetConfig(args[0])
		if err != nil {
			log.WithError(err).WithField("filename", args[0]).Fatal("cannot load config")
		}

		ctrl.SetLogger(logrusr.New(log.Log))

		opts := ctrl.Options{
			Scheme:                 scheme,
			Namespace:              cfg.Namespace,
			HealthProbeBindAddress: cfg.ReadinessProbeAddr,
			LeaderElection:         false,
		}

		if cfg.PrometheusAddr != "" {
			opts.MetricsBindAddress = cfg.PrometheusAddr
		}

		mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), opts)
		if err != nil {
			log.WithError(err).Fatal(err, "unable to start manager")
		}

		if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
			log.WithError(err).Fatal("unable to set up health check")
		}
		if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
			log.WithError(err).Fatal(err, "unable to set up ready check")
		}

		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}

		workspaceInfoProvider := proxy.NewRemoteWorkspaceInfoProvider(mgr.GetClient(), mgr.GetScheme())
		err = workspaceInfoProvider.SetupWithManager(mgr)
		if err != nil {
			log.WithError(err).Fatal(err, "unable to create controller", "controller", "Pod")
		}

		log.Infof("workspace info provider started")

		go proxy.NewWorkspaceProxy(cfg.Ingress, cfg.Proxy, proxy.HostBasedRouter(cfg.Ingress.Header, cfg.Proxy.GitpodInstallation.WorkspaceHostSuffix, cfg.Proxy.GitpodInstallation.WorkspaceHostSuffixRegex), workspaceInfoProvider).MustServe()
		log.Infof("started proxying on %s", cfg.Ingress.HTTPAddress)

		log.Info("🚪 ws-proxy is up and running")
		if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
			log.WithError(err).Fatal(err, "problem starting ws-proxy")
		}

		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	rootCmd.AddCommand(runCmd)
}

var scheme = runtime.NewScheme()
