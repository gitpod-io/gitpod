// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"fmt"
	"os"

	goflag "flag"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
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
