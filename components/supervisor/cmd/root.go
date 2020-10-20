// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "supervisor",
	Short: "Workspace container init process",
}

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "supervisor"
	// Version of this service - set during build
	Version = ""
)

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	log.Init(ServiceName, Version, true, true)

	var c *cobra.Command
	if strings.Contains(os.Args[0], "newuidmap") {
		c = newuidmapCmd
	} else if strings.Contains(os.Args[0], "newgidmap") {
		c = newgidmapCmd
	} else {
		c = rootCmd
	}

	if err := c.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
