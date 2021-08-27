// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-daemon"
	// Version of this service - set during build
	Version = ""
)

var verbose bool
var configFile string
var rootCmd = &cobra.Command{
	Use:   "ws-daemond",
	Short: "Workspace initialization and synchronization daemon",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, verbose, verbose)
	},
}

// Execute runs this main command
func Execute() {
	closer := tracing.Init("ws-daemon")
	if closer != nil {
		defer closer.Close()
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func getConfig() *config.Config {
	ctnt, err := os.ReadFile(configFile)
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration. Maybe missing --config?")
	}

	var cfg config.Config
	dec := json.NewDecoder(bytes.NewReader(ctnt))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		log.WithError(err).Fatal("cannot decode configuration. Maybe missing --config?")
	}

	return &cfg
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")
	rootCmd.PersistentFlags().StringVar(&configFile, "config", "", "config file")
}
