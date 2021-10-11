// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net"

	// Import all Kubernetes client auth plugins (e.g. Azure, GCP, OIDC, etc.)
	// to ensure that exec-entrypoint and run can make use of them.
	_ "k8s.io/client-go/plugin/pkg/client/auth"

	"github.com/bombsimon/logrusr"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/metrics"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager"
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

		common_grpc.SetupLogging()

		ctrl.SetLogger(logrusr.NewLogger(log.Log))

		opts := ctrl.Options{
			Scheme:    scheme,
			Namespace: cfg.Manager.Namespace,
			//Port:                   9443,
			HealthProbeBindAddress: ":0",
			LeaderElection:         false,
			LeaderElectionID:       "ws-manager-leader.gitpod.io",
		}

		if cfg.Prometheus.Addr != "" {
			opts.MetricsBindAddress = cfg.Prometheus.Addr
			err := metrics.Registry.Register(common_grpc.ClientMetrics())
			if err != nil {
				log.WithError(err).Error("Prometheus metrics incomplete")
			}
		}

		mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), opts)
		if err != nil {
			log.WithError(err).Fatal(err, "unable to start manager")
		}

		kubeConfig, err := ctrl.GetConfig()
		if err != nil {
			log.WithError(err).Fatal(err, "unable to create a Kubernetes API Client configuration")
		}
		if err != nil {
			log.WithError(err).Fatal(err, "unable to getting Kubernetes client config")
		}

		clientset, err := kubernetes.NewForConfig(kubeConfig)
		if err != nil {
			log.WithError(err).Fatal(err, "constructing Kubernetes client")
		}

		if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
			log.WithError(err).Fatal("unable to set up health check")
		}
		if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
			log.WithError(err).Fatal(err, "unable to set up ready check")
		}

		cp, err := layer.NewProvider(&cfg.Content.Storage)
		if err != nil {
			log.WithError(err).Fatal("invalid content provider configuration")
		}

		mgmt, err := manager.New(cfg.Manager, mgr.GetClient(), clientset, cp)
		if err != nil {
			log.WithError(err).Fatal("cannot create manager")
		}
		defer mgmt.Close()

		if cfg.Prometheus.Addr != "" {
			err = mgmt.RegisterMetrics(metrics.Registry)
			if err != nil {
				log.WithError(err).Error("Prometheus metrics incomplete")
			}
		}

		if len(cfg.RPCServer.RateLimits) > 0 {
			log.WithField("ratelimits", cfg.RPCServer.RateLimits).Info("imposing rate limits on the gRPC interface")
		}
		ratelimits := common_grpc.NewRatelimitingInterceptor(cfg.RPCServer.RateLimits)

		grpcMetrics := grpc_prometheus.NewServerMetrics()
		grpcMetrics.EnableHandlingTimeHistogram()
		metrics.Registry.MustRegister(grpcMetrics)

		grpcOpts := common_grpc.ServerOptionsWithInterceptors(
			[]grpc.StreamServerInterceptor{grpcMetrics.StreamServerInterceptor()},
			[]grpc.UnaryServerInterceptor{grpcMetrics.UnaryServerInterceptor(), ratelimits.UnaryInterceptor()},
		)
		if cfg.RPCServer.TLS.CA != "" && cfg.RPCServer.TLS.Certificate != "" && cfg.RPCServer.TLS.PrivateKey != "" {
			tlsConfig, err := common_grpc.ClientAuthTLSConfig(
				cfg.RPCServer.TLS.CA, cfg.RPCServer.TLS.Certificate, cfg.RPCServer.TLS.PrivateKey,
				common_grpc.WithSetClientCAs(true),
				common_grpc.WithServerName("ws-manager"),
			)
			if err != nil {
				log.WithError(err).Fatal("cannot load ws-manager certs")
			}

			grpcOpts = append(grpcOpts, grpc.Creds(credentials.NewTLS(tlsConfig)))
		} else {
			log.Warn("no TLS configured - gRPC server will be unsecured")
		}

		grpcServer := grpc.NewServer(grpcOpts...)
		defer grpcServer.Stop()
		grpc_prometheus.Register(grpcServer)

		manager.Register(grpcServer, mgmt)
		lis, err := net.Listen("tcp", cfg.RPCServer.Addr)
		if err != nil {
			log.WithError(err).WithField("addr", cfg.RPCServer.Addr).Fatal("cannot start RPC server")
		}
		//nolint:errcheck
		go grpcServer.Serve(lis)
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
			log.WithError(err).Fatal(err, "unable to create controller", "controller", "Pod")
		}

		if cfg.PProf.Addr != "" {
			go pprof.Serve(cfg.PProf.Addr)
		}

		// run until we're told to stop
		log.Info("🦸  wsman is up and running. Stop with SIGINT or CTRL+C")
		if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
			log.WithError(err).Fatal(err, "problem starting wsman")
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
