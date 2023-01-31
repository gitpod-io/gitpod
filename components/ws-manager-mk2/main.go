// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"os"
	"strings"

	// Import all Kubernetes client auth plugins (e.g. Azure, GCP, OIDC, etc.)
	// to ensure that exec-entrypoint and run can make use of them.
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	_ "k8s.io/client-go/plugin/pkg/client/auth"

	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/mwitkow/grpc-proxy/proxy"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	"sigs.k8s.io/controller-runtime/pkg/metrics"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/controllers"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/activity"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/service"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
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
	var enableLeaderElection bool
	var configFN string
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

	if cfg.PProf.Addr != "" {
		go pprof.Serve(cfg.PProf.Addr)
	}

	mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
		Scheme:                 scheme,
		MetricsBindAddress:     cfg.Prometheus.Addr,
		Port:                   9443,
		HealthProbeBindAddress: cfg.Health.Addr,
		LeaderElection:         enableLeaderElection,
		LeaderElectionID:       "0616d21e.gitpod.io",
		Namespace:              cfg.Manager.Namespace,
	})
	if err != nil {
		setupLog.Error(err, "unable to start manager")
		os.Exit(1)
	}

	reconciler, err := controllers.NewWorkspaceReconciler(mgr.GetClient(), mgr.GetScheme(), cfg.Manager, metrics.Registry)
	if err != nil {
		setupLog.Error(err, "unable to create controller", "controller", "Workspace")
		os.Exit(1)
	}
	activity := &activity.WorkspaceActivity{}
	timeoutReconciler, err := controllers.NewTimeoutReconciler(mgr.GetClient(), cfg.Manager, activity)
	if err != nil {
		setupLog.Error(err, "unable to create timeout controller", "controller", "Timeout")
		os.Exit(1)
	}

	wsmanService, err := setupGRPCService(cfg, mgr.GetClient(), activity)
	if err != nil {
		setupLog.Error(err, "unable to start manager service")
		os.Exit(1)
	}

	reconciler.OnReconcile = wsmanService.OnWorkspaceReconcile
	if err = reconciler.SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to set up workspace controller with manager", "controller", "Workspace")
		os.Exit(1)
	}
	if err = timeoutReconciler.SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to set up timeout controller with manager", "controller", "Timeout")
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

func setupGRPCService(cfg *config.ServiceConfiguration, k8s client.Client, activity *activity.WorkspaceActivity) (*service.WorkspaceManagerServer, error) {
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

	grpcOpts = append(grpcOpts, grpc.UnknownServiceHandler(proxy.TransparentHandler(imagebuilderDirector(cfg.ImageBuilderProxy.TargetAddr))))

	srv := service.NewWorkspaceManagerServer(k8s, &cfg.Manager, metrics.Registry, activity)

	grpcServer := grpc.NewServer(grpcOpts...)
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

	return &cfg, nil
}

func imagebuilderDirector(targetAddr string) proxy.StreamDirector {
	if targetAddr == "" {
		return func(ctx context.Context, fullMethodName string) (context.Context, *grpc.ClientConn, error) {
			return ctx, nil, status.Error(codes.Unimplemented, "Unknown method")
		}
	}

	return func(ctx context.Context, fullMethodName string) (outCtx context.Context, conn *grpc.ClientConn, err error) {
		md, _ := metadata.FromIncomingContext(ctx)
		outCtx = metadata.NewOutgoingContext(ctx, md.Copy())

		if strings.HasPrefix(fullMethodName, "/builder.") {
			conn, err = grpc.DialContext(ctx, targetAddr, grpc.WithInsecure())
			return
		}

		return outCtx, nil, status.Error(codes.Unimplemented, "Unknown method")
	}
}
