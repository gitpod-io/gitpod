// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	containerd_log "github.com/containerd/containerd/log"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/blobserve/pkg/blobserve"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "blobserve"
	// Version of this service - set during build
	Version = ""
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "blobserve",
	Short: "This service provides static assets from OCI images",
	Args:  cobra.MinimumNArgs(1),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, verbose)

		// configure containerd log with gitpod-io configuration
		containerd_log.WithLogger(context.Background(), log.Log)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	closer := tracing.Init("blobserve")
	if closer != nil {
		defer closer.Close()
	}
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")
}

// Config configures this servuce
type Config struct {
	BlobServe      blobserve.Config `json:"blobserve"`
	AuthCfg        string           `json:"dockerAuth"`
	PProfAddr      string           `json:"pprofAddr"`
	PrometheusAddr string           `json:"prometheusAddr"`
}

// getConfig loads and validates the configuration
func getConfig(fn string) (*Config, error) {
	fc, err := os.ReadFile(fn)
	if err != nil {
		return nil, err
	}

	var cfg Config
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}
