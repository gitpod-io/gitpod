// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/kedge/pkg/kedge"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "kedge"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var jsonLog bool
var verbose bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "kedge",
	Short: "Remote kubernetes service discovery and replication",
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
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "confg.json", "config file")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().String("kubeconfig", "", "kubernetes client config file")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")
}

func getConfig() (*config, error) {
	fc, err := ioutil.ReadFile(cfgFile)
	if err != nil {
		return nil, xerrors.Errorf("cannot read config: %w", err)
	}

	var cfg config
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, err
	}

	for i, c := range cfg.Collection.StaticCollection {
		if c.Token == "" {
			cfg.Collection.StaticCollection[i].Token = cfg.Token
		}
	}
	if cfg.Kubeconfig == "" {
		cfg.Kubeconfig, _ = rootCmd.PersistentFlags().GetString("kubeconfig")
	}

	return &cfg, nil
}

type config struct {
	Port  uint16 `json:"port,omitempty"`
	Token string `json:"token"`

	Namespace  string   `json:"namespace"`
	Kubeconfig string   `json:"kubeconfig"`
	Services   []string `json:"services"`

	Collection struct {
		Period              util.Duration     `json:"period"`
		StaticCollection    []kedge.Collector `json:"collectors"`
		FailureTTLService   int               `json:"failureTTLService"`
		FailureTTLCollector int               `json:"failureTTLCollector"`
	} `json:"collection"`

	Registration struct {
		Enabled bool `json:"enabled"`
		// Token defaults to the overall token
		Token string `json:"token,omitempty"`
	} `json:"registration,omitempty"`

	Notifications []struct {
		URL     string        `json:"url"`
		Token   string        `json:"token,omitempty"`
		Timeout util.Duration `json:"timeout,omitempty"`
	} `json:"notifications"`
}
