// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-daemon"
	// Version of this service - set during build
	Version = ""
)

var verbose bool
var configFile string
var jsonLog bool

var rootCmd = &cobra.Command{
	Use:   "ws-daemond",
	Short: "Workspace initialization and synchronization daemon",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, verbose)
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

func init() {
	rand.Seed(time.Now().UnixNano())

	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")
	rootCmd.PersistentFlags().StringVar(&configFile, "config", "", "config file")
}
