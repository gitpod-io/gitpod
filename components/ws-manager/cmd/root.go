// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-manager"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var kubeconfig string
var jsonLog bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "ws-manager",
	Short: "ws-manager starts/stops/controls workspace deployments in Kubernetes",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, jsonLog)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
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

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.kedgei.yaml)")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "v", false, "produce JSON log output on verbose level")

	rootCmd.PersistentFlags().StringVar(&kubeconfig, "kubeconfig", "", "path to the kubeconfig file to use (defaults to in-cluster config)")
}

func getConfig() *Configuration {
	ctnt, err := os.ReadFile(cfgFile)
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration. Maybe missing --config?")
	}

	var cfg Configuration
	dec := json.NewDecoder(bytes.NewReader(ctnt))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		log.WithError(err).Fatal("cannot decode configuration. Maybe missing --config?")
	}

	return &cfg
}

type Configuration struct {
	Manager config.Configuration `json:"manager"`
	Content struct {
		Storage storage.Config `json:"storage"`
	} `json:"content"`
	RPCServer struct {
		Addr string `json:"addr"`
		TLS  struct {
			CA          string `json:"ca"`
			Certificate string `json:"crt"`
			PrivateKey  string `json:"key"`
		} `json:"tls"`
		RateLimits map[string]grpc.RateLimit `json:"ratelimits"`
	} `json:"rpcServer"`

	PProf struct {
		Addr string `json:"addr"`
	} `json:"pprof"`
	Prometheus struct {
		Addr string `json:"addr"`
	} `json:"prometheus"`
}
