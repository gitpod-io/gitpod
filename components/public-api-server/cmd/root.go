// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "public-api-server"
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
	Short: "Serves public API services",
}

func Execute() {
	if err := rootCmd.ExecuteContext(context.Background()); err != nil {
		log.WithError(err).Error("Failed to execute command.")
		os.Exit(1)
	}
}
