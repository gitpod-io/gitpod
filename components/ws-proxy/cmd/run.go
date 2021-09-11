// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/tcpproxy"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/ratelimit"
)

var jsonLog bool

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run <config.json>",
	Short: "Starts ws-proxy",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := getConfig(args[0])
		if err != nil {
			log.WithError(err).WithField("filename", args[0]).Fatal("cannot load config")
		}

		common_grpc.SetupLogging()

		const wsmanConnectionAttempts = 5
		workspaceInfoProvider := proxy.NewRemoteWorkspaceInfoProvider(cfg.WorkspaceInfoProviderConfig)
		for i := 0; i < wsmanConnectionAttempts; i++ {
			err = workspaceInfoProvider.Run()
			if err == nil {
				break
			}
			if i == wsmanConnectionAttempts-1 {
				continue
			}

			log.WithError(err).Error("cannot start workspace info provider - will retry in 10 seconds")
			time.Sleep(10 * time.Second)
		}
		if err != nil {
			log.WithError(err).Fatal("cannot start workspace info provider")
		}
		log.Infof("workspace info provider started")

		go proxy.NewWorkspaceProxy(cfg.Ingress, cfg.Proxy, proxy.HostBasedRouter(cfg.Ingress.Header, cfg.Proxy.GitpodInstallation.WorkspaceHostSuffix, cfg.Proxy.GitpodInstallation.WorkspaceHostSuffixRegex), workspaceInfoProvider).MustServe()
		log.Infof("started proxying on %s", cfg.Ingress.HttpAddress)

		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}
		if cfg.PrometheusAddr != "" {
			reg := prometheus.NewRegistry()
			reg.MustRegister(
				prometheus.NewGoCollector(),
				prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
			)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))

			go func() {
				err := http.ListenAndServe(cfg.PrometheusAddr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
		}
		if cfg.ReadinessProbeAddr != "" {
			go func() {
				err = http.ListenAndServe(cfg.ReadinessProbeAddr, http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
					if workspaceInfoProvider.Ready() {
						resp.WriteHeader(http.StatusOK)
					} else {
						resp.WriteHeader(http.StatusServiceUnavailable)
					}
				}))

				if err != nil {
					log.WithError(err).Fatal("readiness endpoint server failed")
				}
			}()
		}

		ctx, cancel := context.WithCancel(context.Background())
		if cfg.WSManagerProxy.ListenAddress != "" {
			go func() {
				tcpProxyListenAddr := cfg.WSManagerProxy.ListenAddress
				wsManagerAddr := cfg.WorkspaceInfoProviderConfig.WsManagerAddr
				refillInterval := time.Duration(cfg.WSManagerProxy.RateLimiter.RefillInterval)
				bucketSize := cfg.WSManagerProxy.RateLimiter.BucketSize
				err := startWSManagerTCPProxy(ctx, tcpProxyListenAddr, wsManagerAddr, refillInterval, bucketSize)
				if err != nil {
					log.WithError(err).Fatal("starting ws-manger TCP proxy failed")
				}
			}()
		}

		log.Info("🚪 ws-proxy is up and running")
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan
		log.Info("received SIGTERM, ws-proxy is stopping...")
		cancel()

		defer func() {
			log.Info("ws-proxy stopped.")
		}()
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}

func startWSManagerTCPProxy(ctx context.Context, listenAddr string, wsManagerAddr string, refillInterval time.Duration, bucketSize int) error {
	var p tcpproxy.Proxy
	p.AddRoute(listenAddr, tcpproxy.To(wsManagerAddr))
	if refillInterval != 0 && bucketSize != 0 {
		p.ListenFunc = func(network, address string) (net.Listener, error) {
			return ratelimit.NewListener(
				ctx,
				network,
				address,
				refillInterval,
				bucketSize,
			)
		}
	}
	log.Infof("Forwarding ws-manager traffic: %s -> %s\n", listenAddr, wsManagerAddr)
	return p.Run()
}
