// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/ws-deployment/pkg/config/v1"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-deployment"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var jsonLog bool
var verbose bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "ws-deployment",
	Short: "ws-deployment manages the workspace clusters",
	Long:  "ws-deployment manages the the creation of workspace clusters, installation of gitpod in those clusters and traffic shifting",
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
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
}

func getConfig() *v1.Config {
	ctnt, err := os.ReadFile(cfgFile)
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration. Maybe missing --config?")
	}

	var cfg v1.Config
	dec := yaml.NewDecoder(bytes.NewReader(ctnt))
	err = dec.Decode(&cfg)
	if err != nil {
		log.WithError(err).Fatal("cannot decode configuration. Maybe missing --config?")
	}

	return &cfg
}
