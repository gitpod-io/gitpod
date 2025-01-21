// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "node-labeler"
	// Version of this service - set during build
	Version = ""
)

var (
	jsonLog bool
	verbose bool

	registryFacadePort int
	wsdaemonPort       int

	namespace string
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   ServiceName,
	Short: "node-labeler is in charge of maintaining the node labels that workspaces require to run in a node",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, verbose)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().IntVar(&registryFacadePort, "registry-facade-port", 31750, "registry-facade node port")
	rootCmd.PersistentFlags().IntVar(&wsdaemonPort, "ws-daemon-port", 8080, "ws-daemon service port")
	rootCmd.PersistentFlags().StringVar(&namespace, "namespace", "default", "Namespace where Gitpod components are running")

	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")

}
