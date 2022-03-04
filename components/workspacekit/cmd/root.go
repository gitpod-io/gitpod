// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "workspacekit",
	Short: "Prepares a container for running a Gitpod workspace",
}

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "workspacekit"
	// Version of this service - set during build
	Version = ""
)

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	log.Init(ServiceName, Version, true, false)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
