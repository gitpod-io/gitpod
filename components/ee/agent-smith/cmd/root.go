// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	goflag "flag"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/agent"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "agent-smith"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var jsonLog bool
var verbose bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "agent-smith",
	Short: "Moves through workspace pods and finds bad players",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		os.Args = []string{""}
		log.Init(ServiceName, Version, jsonLog, verbose)

		// Disable golog, Googles logging framwork for misanthropic
		err := goflag.Set("stderrthreshold", "5")
		if err != nil {
			log.Debugf("error while disabling glog: %v", err)
		}
		goflag.Parse()
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
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")
}

func getConfig() (*config, error) {
	if cfgFile == "" {
		return nil, xerrors.Errorf("missing --config")
	}

	fc, err := ioutil.ReadFile(cfgFile)
	if err != nil {
		return nil, xerrors.Errorf("cannot read config: %v", err)
	}

	var cfg config
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal config: %v", err)
	}

	if cfg.ProbePath == "" {
		cfg.ProbePath = "/app/probe.o"
	}

	return &cfg, nil
}

// config is the struct holding the configuration for agent-smith
// if you are considering changing this struct, remember
// to update the config schema using:
// $ go run main.go config-schema > config-schema.json
// And also update the examples accordingly.
type config struct {
	agent.Config

	Namespace string `json:"namespace,omitempty"`

	PProfAddr      string `json:"pprofAddr,omitempty"`
	PrometheusAddr string `json:"prometheusAddr,omitempty"`

	// We have had memory leak issues with agent smith in the past due to experimental gRPC use.
	// This upper limit causes agent smith to stop itself should it go above this limit.
	MaxSysMemMib uint64 `json:"systemMemoryLimitMib,omitempty"`

	HostURL        string `json:"hostURL,omitempty"`
	GitpodAPIToken string `json:"gitpodAPIToken,omitempty"`
}
