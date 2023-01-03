// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "registry"
	// Version of this service - set during build
	Version = ""
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   ServiceName,
	Short: "This validates a Docker v2 registry connection string",
}

func Execute() {
	cobra.CheckErr(rootCmd.Execute())
}
