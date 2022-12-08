// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/bombsimon/logrusr/v2"
	"github.com/gitpod-io/golang-crypto/ssh"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	runtime_client "sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/healthz"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/config"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/sshproxy"
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

		workspaceInfoProvider := proxy.NewRemoteWorkspaceInfoProvider(mgr.GetClient(), mgr.GetScheme())
		err = workspaceInfoProvider.SetupWithManager(mgr)
		if err != nil {
			log.WithError(err).Fatal(err, "unable to create controller", "controller", "Pod")
		}

		if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
			log.WithError(err).Fatal("unable to set up health check")
		}
		if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
			log.WithError(err).Fatal(err, "unable to set up ready check")
		}
		if err := mgr.AddReadyzCheck("readyz", readyCheck(mgr.GetClient(), cfg.Namespace)); err != nil {
			log.WithError(err).Fatal(err, "unable to set up ready check")
		}

		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}

		log.Infof("workspace info provider started")

		var heartbeat sshproxy.Heartbeat
		if wsm := cfg.WorkspaceManager; wsm != nil {
			var dialOption grpc.DialOption = grpc.WithTransportCredentials(insecure.NewCredentials())
			if wsm.TLS.CA != "" && wsm.TLS.Cert != "" && wsm.TLS.Key != "" {
				tlsConfig, err := common_grpc.ClientAuthTLSConfig(
					wsm.TLS.CA, wsm.TLS.Cert, wsm.TLS.Key,
					common_grpc.WithSetRootCAs(true),
					common_grpc.WithServerName("ws-manager"),
				)
				if err != nil {
					log.WithField("config", wsm.TLS).Error("Cannot load ws-manager certs - this is a configuration issue.")
					log.WithError(err).Fatal("cannot load ws-manager certs")
				}

				dialOption = grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig))
			}

			grpcOpts := common_grpc.DefaultClientOptions()
			grpcOpts = append(grpcOpts, dialOption)

			conn, err := grpc.Dial(wsm.Addr, grpcOpts...)
			if err != nil {
				log.WithError(err).Fatal("cannot connect to ws-manager")
			}

			heartbeat = &sshproxy.WorkspaceManagerHeartbeat{
				Client: wsmanapi.NewWorkspaceManagerClient(conn),
			}
		}

		// SSH Gateway
		var signers []ssh.Signer
		flist, err := os.ReadDir("/mnt/host-key")
		if err == nil && len(flist) > 0 {
			for _, f := range flist {
				if f.IsDir() {
					continue
				}
				b, err := os.ReadFile(filepath.Join("/mnt/host-key", f.Name()))
				if err != nil {
					continue
				}
				hostSigner, err := ssh.ParsePrivateKey(b)
				if err != nil {
					continue
				}
				signers = append(signers, hostSigner)
			}
			if len(signers) > 0 {
				server := sshproxy.New(signers, workspaceInfoProvider, heartbeat)
				l, err := net.Listen("tcp", ":2200")
				if err != nil {
					panic(err)
				}
				go server.Serve(l)
				log.Info("SSHGateway is up and running")
			}
		}

		go proxy.NewWorkspaceProxy(cfg.Ingress, cfg.Proxy, proxy.HostBasedRouter(cfg.Ingress.Header, cfg.Proxy.GitpodInstallation.WorkspaceHostSuffix, cfg.Proxy.GitpodInstallation.WorkspaceHostSuffixRegex), workspaceInfoProvider, signers).MustServe()
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

// Ready check that verify we can list pods
func readyCheck(client runtime_client.Client, namespace string) func(*http.Request) error {
	return func(*http.Request) error {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()

		var wsProxyPod corev1.Pod
		err := client.Get(ctx, types.NamespacedName{Namespace: namespace, Name: "readyz-pod"}, &wsProxyPod)
		if errors.IsNotFound(err) {
			// readyz-pod is not a valid name
			// we just need to check there are no errors reaching the API server
			return nil
		}

		return err
	}
}
