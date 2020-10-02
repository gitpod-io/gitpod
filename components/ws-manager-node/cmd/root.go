// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/daemon"
	"github.com/spf13/cobra"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-manager-node"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var kubeconfig string
var jsonLog bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "ws-manager-node",
	Short: "ws-manager-node controls the behaviour of workspaces on a node",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, jsonLog)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	var c *cobra.Command
	fmt.Println(os.Args)
	if strings.Contains(os.Args[0], "newuidmap") {
		c = newuidmapCmd
	} else if strings.Contains(os.Args[0], "newgidmap") {
		c = newgidmapCmd
	} else {
		closer := tracing.Init(ServiceName)
		if closer != nil {
			defer closer.Close()
		}
		c = rootCmd
	}

	if err := c.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "v", false, "produce JSON log output on verbose level")
}

func getConfig() *config {
	ctnt, err := ioutil.ReadFile(cfgFile)
	if err != nil {
		log.WithError(err).Error("cannot read configuration. Maybe missing --config?")
		os.Exit(1)
	}

	var cfg config
	err = json.Unmarshal(ctnt, &cfg)
	if err != nil {
		log.WithError(err).Error("cannot read configuration. Maybe missing --config?")
		os.Exit(1)
	}

	return &cfg
}

type config struct {
	Daemon        daemon.Configuration `json:"daemon"`
	RPCServerAddr string               `json:"rpcServerAddr"`
	TLS           struct {
		Certificate string `json:"crt"`
		PrivateKey  string `json:"key"`
	} `json:"tls"`

	PProfAddr      string `json:"pprofAddr"`
	PrometheusAddr string `json:"prometheusAddr"`
}
