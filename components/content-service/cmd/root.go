// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/api/config"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "content-service"
	// Version of this service - set during build
	Version = ""
)

var jsonLog bool
var verbose bool
var configFile string

var rootCmd = &cobra.Command{
	Use:   "content-service",
	Short: "Content service",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, verbose)
	},
}

// Execute runs this main command
func Execute() {
	closer := tracing.Init(ServiceName)
	if closer != nil {
		defer closer.Close()
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func getConfig() *config.ServiceConfig {
	ctnt, err := os.ReadFile(configFile)
	if err != nil {
		log.WithError(xerrors.Errorf("cannot read config: %w", err)).Error("cannot read configuration. Maybe missing --config?")
		os.Exit(1)
	}

	var cfg config.ServiceConfig
	err = json.Unmarshal(ctnt, &cfg)
	if err != nil {
		log.WithError(err).Error("cannot read configuration. Maybe missing --config?")
		os.Exit(1)
	}

	return &cfg
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")
	rootCmd.PersistentFlags().StringVar(&configFile, "config", "", "config file")
}
