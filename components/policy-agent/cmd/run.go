// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/policy-agent/api/config"
	"github.com/gitpod-io/gitpod/policy-agent/pkg/provider"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"google.golang.org/grpc"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
)

var jsonLog bool
var verbose bool

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run <config.json>",
	Short: "Starts the registry facade",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		configPath := args[0]
		cfg, err := config.GetConfig(configPath)
		if err != nil {
			log.WithError(err).WithField("filename", configPath).Fatal("cannot load config")
		}

		grpcMetrics := grpc_prometheus.NewServerMetrics()
		grpcMetrics.EnableHandlingTimeHistogram()

		promreg := prometheus.NewRegistry()
		if cfg.PrometheusAddr != "" {
			promreg.MustRegister(
				collectors.NewGoCollector(),
				collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
				common_grpc.ClientMetrics(),
				grpcMetrics,
			)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(promreg, promhttp.HandlerOpts{}))

			go func() {
				err := http.ListenAndServe(cfg.PrometheusAddr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
		}
		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}

		p, err := provider.NewFilePolicyProvider(cfg.PolicyAgent.FileProvider.Path)
		if err != nil {
			log.WithError(err).WithField("path", cfg.PolicyAgent.FileProvider.Path).Fatalf("failed to load policy")
		}
		delegatingProv := provider.NewDelegatePolicyProvider(p)
		go watchConfig(configPath, delegatingProv)

		grpcServer := grpc.NewServer(grpcMetrics.StreamServerInterceptor(), grpcMetrics.UnaryServerInterceptor())
		defer grpcServer.Stop()
		grpc_prometheus.Register(grpcServer)

		log.Info("🏪 policy-agent is up and running")
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		select {
		case <-sigChan:
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}

// watchConfig watches the configuration file and if changed reloads the static layer
func watchConfig(fn string, srv *provider.DelegatePolicyProvider) {
	hashConfig := func() (hash string, err error) {
		f, err := os.Open(fn)
		if err != nil {
			return "", err
		}
		defer f.Close()

		h := sha256.New()
		_, err = io.Copy(h, f)
		if err != nil {
			return "", err
		}

		return hex.EncodeToString(h.Sum(nil)), nil
	}
	reloadConfig := func() error {
		cfg, err := config.GetConfig(fn)
		if err != nil {
			return err
		}

		p, err := provider.NewFilePolicyProvider(cfg.PolicyAgent.FileProvider.Path)
		if err != nil {
			return err
		}

		srv.Update(p)
		return nil
	}

	var (
		tick    = time.NewTicker(30 * time.Second)
		oldHash string
	)
	defer tick.Stop()
	for range tick.C {
		currentHash, err := hashConfig()
		if err != nil {
			log.WithError(err).Warn("cannot check if config has changed")
		}

		if oldHash == "" {
			oldHash = currentHash
		}
		if currentHash == oldHash {
			continue
		}
		oldHash = currentHash

		err = reloadConfig()
		if err == nil {
			log.Info("configuration was updated - reloaded static layer config")
		} else {
			log.WithError(err).Error("cannot reload config - config hot reloading did not work")
		}
	}
}
