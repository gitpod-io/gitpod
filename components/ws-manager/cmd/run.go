// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	// Import all Kubernetes client auth plugins (e.g. Azure, GCP, OIDC, etc.)
	// to ensure that exec-entrypoint and run can make use of them.
	_ "k8s.io/client-go/plugin/pkg/client/auth"

	"github.com/bombsimon/logrusr/v2"
	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/proxy"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"

	volumesnapshotv1 "github.com/kubernetes-csi/external-snapshotter/client/v4/apis/volumesnapshot/v1"
	volumesnapshotclientv1 "github.com/kubernetes-csi/external-snapshotter/client/v4/clientset/versioned"
)

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the workspace monitor",

	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		err := cfg.Manager.Validate()
		if err != nil {
			log.WithError(err).Fatal("invalid configuration")
		}
		log.Info("wsman configuration is valid")

		srv, err := baseserver.New("ws-manager", baseserver.WithConfig(cfg.Server))

		//common_grpc.SetupLogging()

		ctrl.SetLogger(logrusr.New(log.Log))

		opts := ctrl.Options{
			Scheme:    scheme,
			Namespace: cfg.Manager.Namespace,
			//Port:                   9443,
			HealthProbeBindAddress: ":0",
			LeaderElection:         false,
			LeaderElectionID:       "ws-manager-leader.gitpod.io",
		}

		//if cfg.Prometheus.Addr != "" {
		//	opts.MetricsBindAddress = cfg.Prometheus.Addr
		//	err := metrics.Registry.Register(common_grpc.ClientMetrics())
		//	if err != nil {
		//		log.WithError(err).Error("Prometheus metrics incomplete")
		//	}
		//}

		mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), opts)
		if err != nil {
			log.WithError(err).Fatal("unable to start manager")
		}

		kubeConfig, err := ctrl.GetConfig()
		if err != nil {
			log.WithError(err).Fatal("unable to getting Kubernetes client config")
		}

		clientset, err := kubernetes.NewForConfig(kubeConfig)
		if err != nil {
			log.WithError(err).Fatal("constructing Kubernetes client")
		}

		volumesnapshotclientset, err := volumesnapshotclientv1.NewForConfig(kubeConfig)
		if err != nil {
			log.WithError(err).Fatal("constructing volume snapshot client")
		}

		if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
			log.WithError(err).Fatal("unable to set up health check")
		}
		if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
			log.WithError(err).Fatal("unable to set up ready check")
		}

		cp, err := layer.NewProvider(&cfg.Content.Storage)
		if err != nil {
			log.WithError(err).Fatal("invalid content provider configuration")
		}

		err = volumesnapshotv1.AddToScheme(mgr.GetScheme())
		if err != nil {
			log.WithError(err).Fatal("cannot register Kubernetes volumesnapshotv1 schema - this should never happen")
		}

		mgmt, err := manager.New(cfg.Manager, mgr.GetClient(), clientset, volumesnapshotclientset, cp)
		if err != nil {
			log.WithError(err).Fatal("cannot create manager")
		}
		defer mgmt.Close()

		mgmt.RegisterMetrics(srv.MetricsRegistry())

		if len(cfg.RPCServer.RateLimits) > 0 {
			log.WithField("ratelimits", cfg.RPCServer.RateLimits).Info("imposing rate limits on the gRPC interface")
		}
		ratelimits := common_grpc.NewRatelimitingInterceptor(cfg.RPCServer.RateLimits)

		srv.MetricsRegistry().MustRegister(ratelimits)

		grpcOpts := common_grpc.ServerOptionsWithInterceptors(
			[]grpc.UnaryServerInterceptor{ratelimits.UnaryInterceptor()},
		)

		if cfg.ImageBuilderProxy.TargetAddr != "" {
			// Note: never use block here, because image-builder connects to ws-manager,
			//       and if we blocked here, ws-manager wouldn't come up, hence we couldn't connect to ws-manager.
			conn, err := grpc.Dial(cfg.ImageBuilderProxy.TargetAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				log.WithError(err).Fatal("failed to connect to image builder")
			}
			imgbldr.RegisterImageBuilderServer(grpcServer, proxy.ImageBuilder{D: imgbldr.NewImageBuilderClient(conn)})
		}

		manager.Register(srv.GRPC(), mgmt)

		//nolint:errcheck
		go func() {
			if err := srv.ListenAndServe(); err != nil {

			}
		}()
		log.WithField("addr", cfg.RPCServer.Addr).Info("started gRPC server")

		monitor, err := mgmt.CreateMonitor()
		if err != nil {
			log.WithError(err).Fatal("cannot start workspace monitor")
		}

		go func() {
			mgr.GetCache().WaitForCacheSync(context.Background())

			err = monitor.Start()
			if err != nil {
				log.WithError(err).Fatal("cannot start workspace monitor")
			}
		}()

		defer monitor.Stop()
		log.Info("workspace monitor is up and running")

		err = (&manager.PodReconciler{
			Monitor: monitor,
			Client:  mgr.GetClient(),
			Log:     ctrl.Log.WithName("controllers").WithName("Pod"),
			Scheme:  mgr.GetScheme(),
		}).SetupWithManager(mgr)
		if err != nil {
			log.WithError(err).Fatal("unable to create controller", "controller", "Pod")
		}

		// run until we're told to stop
		log.Info("🦸  wsman is up and running. Stop with SIGINT or CTRL+C")
		if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
			log.WithError(err).Fatal("problem starting wsman")
		}

		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	rootCmd.AddCommand(runCmd)
}

var (
	scheme = runtime.NewScheme()
)
