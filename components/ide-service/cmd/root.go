// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"path"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ide-service-api/config"
	"github.com/spf13/cobra"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ide-service"
	// Version of this service - set during build
	Version = ""
)

var rootOpts struct {
	CfgFile string
	JsonLog bool
	Verbose bool
}

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   ServiceName,
	Short: "IDE Service API services",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, rootOpts.JsonLog, rootOpts.Verbose)
	},
}

func Execute() {
	if err := rootCmd.ExecuteContext(context.Background()); err != nil {
		log.WithError(err).Error("failed to execute command.")
		os.Exit(1)
	}
}

func init() {
	localConfig := path.Join(os.ExpandEnv("GOMOD"), "..", "config.json")
	rootCmd.PersistentFlags().StringVar(&rootOpts.CfgFile, "config", localConfig, "config file")
	rootCmd.PersistentFlags().BoolVar(&rootOpts.JsonLog, "json-log", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVar(&rootOpts.Verbose, "verbose", false, "enable verbose JSON logging")
}

func getConfig() *config.ServiceConfiguration {
	cfg, err := config.Read(rootOpts.CfgFile)
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration")
	}
	return cfg
}
