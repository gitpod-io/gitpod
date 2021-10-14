// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-deployment"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var kubeconfig string
var jsonLog bool
var verbose bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "ws-deployment",
	Short: "ws-deployment manages the workspace clusters",
	Short: "ws-deployment manages the the creation of workspace clusters, installation of gitpod in those clusters and traffic shifting",
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
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "c", "config file (default is $HOME/ws-deployment.yaml)")
	// rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	// rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")

	// rootCmd.PersistentFlags().StringVar(&kubeconfig, "kubeconfig", "", "path to the kubeconfig file to use (defaults to in-cluster config)")
}

// func getConfig() *config.ServiceConfiguration {
// 	ctnt, err := os.ReadFile(cfgFile)
// 	if err != nil {
// 		log.WithError(err).Fatal("cannot read configuration. Maybe missing --config?")
// 	}

// 	// var cfg config.
// 	dec := json.NewDecoder(bytes.NewReader(ctnt))
// 	dec.DisallowUnknownFields()
// 	err = dec.Decode(&cfg)
// 	if err != nil {
// 		log.WithError(err).Fatal("cannot decode configuration. Maybe missing --config?")
// 	}

// 	return &cfg
// }
