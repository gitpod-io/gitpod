// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"os"

	// Import all Kubernetes client auth plugins (e.g. Azure, GCP, OIDC, etc.)
	// to ensure that exec-entrypoint and run can make use of them.
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
	"k8s.io/client-go/rest"

	"github.com/bombsimon/logrusr/v4"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/components/scrubber"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/controllers"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/maintenance"
	imgproxy "github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/proxy"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/service"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	//+kubebuilder:scaffold:imports
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-manager-mk2"
	// Version of this service - set during build
	Version = ""

	scheme   = runtime.NewScheme()
	setupLog = ctrl.Log.WithName("setup")
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))

	utilruntime.Must(workspacev1.AddToScheme(scheme))
	//+kubebuilder:scaffold:scheme
}

func main() {
	var configFN string
	var jsonLog bool
	var verbose bool
	flag.StringVar(&configFN, "config", "", "Path to the config file")
	flag.BoolVar(&jsonLog, "json-log", true, "produce JSON log output on verbose level")
	flag.BoolVar(&verbose, "verbose", false, "Enable verbose logging")
	flag.Parse()

	log.Init(ServiceName, Version, jsonLog, verbose)

	l := log.WithFields(logrus.Fields{})
	l.Logger.SetReportCaller(false)
	baseLogger := logrusr.New(l, logrusr.WithFormatter(func(i interface{}) interface{} {
		return &log.TrustedValueWrap{Value: scrubber.Default.DeepCopyStruct(i)}
	}))
	ctrl.SetLogger(baseLogger)
	// Set the logger used by k8s (e.g. client-go).
	klog.SetLogger(baseLogger)
	promrep := &tracing.PromReporter{
		Operations: map[string]tracing.SpanMetricMapping{
			"StartWorkspace": {
				Name:    "wsman_start_workspace",
				Help:    "time it takes to service a StartWorkspace request",
				Buckets: prometheus.LinearBuckets(0, 500, 10), // 10 buckets, each 500ms wide
			},
		},
	}
	closer := tracing.Init(ServiceName, tracing.WithPrometheusReporter(promrep))
	if closer != nil {
		defer closer.Close()
	}

	cfg, err := getConfig(configFN)
	if err != nil {
		setupLog.Error(err, "unable to read config")
		os.Exit(1)
	}

	if cfg.PProf.Addr != "" {
		go pprof.Serve(cfg.PProf.Addr)
	}

	// Check that namespace config values are set. Empty namespaces default to a cluster-scoped cache,
	// which the controller doesn't have the right RBAC for.
	if cfg.Manager.Namespace == "" {
		setupLog.Error(nil, "namespace cannot be empty")
		os.Exit(1)
	}

	if cfg.Manager.SecretsNamespace == "" {
		setupLog.Error(nil, "secretsNamespace cannot be empty")
		os.Exit(1)
	}

	mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
		Scheme:  scheme,
		Metrics: metricsserver.Options{BindAddress: cfg.Prometheus.Addr},
		Cache: cache.Options{
			DefaultNamespaces: map[string]cache.Config{
				cfg.Manager.Namespace:        {},
				cfg.Manager.SecretsNamespace: {},
			},
		},
		WebhookServer: webhook.NewServer(webhook.Options{
			Port: 9443,
		}),
		HealthProbeBindAddress:        cfg.Health.Addr,
		LeaderElection:                true,
		LeaderElectionID:              "ws-manager-mk2-leader.gitpod.io",
		LeaderElectionReleaseOnCancel: true,
		NewClient: func(config *rest.Config, options client.Options) (client.Client, error) {
			config.QPS = 100
			config.Burst = 150

			c, err := client.New(config, options)
			if err != nil {
				return nil, err
			}

			return c, nil
		},
	})
	if err != nil {
		setupLog.Error(err, "unable to start manager")
		os.Exit(1)
	}

	mgrCtx := ctrl.SetupSignalHandler()

	maintenanceReconciler, err := controllers.NewMaintenanceReconciler(mgr.GetClient(), metrics.Registry)
	if err != nil {
		setupLog.Error(err, "unable to create maintenance controller", "controller", "Maintenance")
		os.Exit(1)
	}

	timeoutReconciler, err := controllers.NewTimeoutReconciler(mgr.GetClient(), mgr.GetEventRecorderFor("workspace"), cfg.Manager, maintenanceReconciler)
	if err != nil {
		setupLog.Error(err, "unable to create timeout controller", "controller", "Timeout")
		os.Exit(1)
	}

	wsmanService, err := setupGRPCService(cfg, mgr.GetClient(), maintenanceReconciler)
	if err != nil {
		setupLog.Error(err, "unable to start manager service")
		os.Exit(1)
	}

	subscriberReconciler, err := controllers.NewSubscriberReconciler(mgr.GetClient(), &cfg.Manager)
	if err != nil {
		setupLog.Error(err, "unable to create subscriber controller", "controller", "Subscribers")
		os.Exit(1)
	}

	subscriberReconciler.OnReconcile = wsmanService.OnWorkspaceReconcile

	if err = subscriberReconciler.SetupWithManager(mgrCtx, mgr); err != nil {
		setupLog.Error(err, "unable to setup workspace controller with manager", "controller", "Subscribers")
		os.Exit(1)
	}

	err = controllers.SetupIndexer(mgr)
	if err != nil {
		setupLog.Error(err, "unable to configure field indexer")
		os.Exit(1)
	}

	go func() {
		<-mgr.Elected()

		workspaceReconciler, err := controllers.NewWorkspaceReconciler(
			mgr.GetClient(), mgr.GetConfig(), mgr.GetScheme(), mgr.GetEventRecorderFor("workspace"), &cfg.Manager, metrics.Registry, maintenanceReconciler)
		if err != nil {
			setupLog.Error(err, "unable to create controller", "controller", "Workspace")
			os.Exit(1)
		}

		if err = workspaceReconciler.SetupWithManager(mgr); err != nil {
			setupLog.Error(err, "unable to setup workspace controller with manager", "controller", "Workspace")
			os.Exit(1)
		}
	}()

	if err = timeoutReconciler.SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to setup timeout controller with manager", "controller", "Timeout")
		os.Exit(1)
	}

	if err = maintenanceReconciler.SetupWithManager(mgrCtx, mgr); err != nil {
		setupLog.Error(err, "unable to setup maintenance controller with manager", "controller", "Maintenance")
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
	if err := mgr.Start(mgrCtx); err != nil {
		setupLog.Error(err, "problem running manager")
		os.Exit(1)
	}
}

func setupGRPCService(cfg *config.ServiceConfiguration, k8s client.Client, maintenance maintenance.Maintenance) (*service.WorkspaceManagerServer, error) {
	// TODO(cw): remove use of common-go/log

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

	if cfg.ImageBuilderProxy.TargetAddr != "" {
		creds := insecure.NewCredentials()
		if cfg.ImageBuilderProxy.TLS.CA != "" && cfg.ImageBuilderProxy.TLS.Certificate != "" && cfg.ImageBuilderProxy.TLS.PrivateKey != "" {
			tlsConfig, err := common_grpc.ClientAuthTLSConfig(
				cfg.ImageBuilderProxy.TLS.CA, cfg.ImageBuilderProxy.TLS.Certificate, cfg.ImageBuilderProxy.TLS.PrivateKey,
				common_grpc.WithSetRootCAs(true),
				common_grpc.WithServerName("image-builder-mk3"),
			)
			if err != nil {
				log.WithError(err).Fatal("cannot load image-builder-mk3 TLS certs")
			}
			log.Info("Loaded TLS for image builder")
			creds = credentials.NewTLS(tlsConfig)
		}
		// Note: never use block here, because image-builder connects to ws-manager,
		//       and if we blocked here, ws-manager wouldn't come up, hence we couldn't connect to ws-manager.
		conn, err := grpc.Dial(cfg.ImageBuilderProxy.TargetAddr, grpc.WithTransportCredentials(creds))
		if err != nil {
			log.WithError(err).Fatal("failed to connect to image builder")
		}
		imgbldr.RegisterImageBuilderServer(grpcServer, imgproxy.ImageBuilder{D: imgbldr.NewImageBuilderClient(conn)})
	}

	srv := service.NewWorkspaceManagerServer(k8s, &cfg.Manager, metrics.Registry, maintenance)

	grpc_prometheus.Register(grpcServer)
	wsmanapi.RegisterWorkspaceManagerServer(grpcServer, srv)
	regapi.RegisterSpecProviderServer(grpcServer, &service.WorkspaceImageSpecProvider{
		Client:    k8s,
		Namespace: cfg.Manager.Namespace,
	})

	lis, err := net.Listen("tcp", cfg.RPCServer.Addr)
	if err != nil {
		log.WithError(err).WithField("addr", cfg.RPCServer.Addr).Fatal("cannot start RPC server")
	}
	go func() {
		err := grpcServer.Serve(lis)
		if err != nil {
			log.WithError(err).Error("gRPC service failed")
		}
	}()
	log.WithField("addr", cfg.RPCServer.Addr).Info("started gRPC server")

	return srv, nil
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

	if cfg.Manager.SSHGatewayCAPublicKeyFile != "" {
		ca, err := os.ReadFile(cfg.Manager.SSHGatewayCAPublicKeyFile)
		if err != nil {
			log.WithError(err).Error("cannot read SSH Gateway CA public key")
			return &cfg, nil
		}
		cfg.Manager.SSHGatewayCAPublicKey = string(ca)
	}
	return &cfg, nil
}
