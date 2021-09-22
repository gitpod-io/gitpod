// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"time"

	homedir "github.com/mitchellh/go-homedir"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "service-waiter"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var jsonLog bool
var verbose bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "service-waiter",
	Short: "service-waiter waits until a service becomes available",
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
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.service-waiter.yaml)")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")

	defaultTimeout := os.Getenv("SERVICE_WAITER_TIMEOUT")
	if defaultTimeout == "" {
		defaultTimeout = "5m"
	}
	rootCmd.PersistentFlags().StringP("timeout", "t", defaultTimeout, "the maximum time to wait for")

	err := viper.BindPFlags(rootCmd.PersistentFlags())
	if err != nil {
		log.WithError(err).Fatal("cannot bind Viper to pflags")
	}
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {
		// Find home directory.
		home, err := homedir.Dir()
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}

		// Search config in home directory with name ".service-waiter" (without extension).
		viper.AddConfigPath(home)
		viper.SetConfigName(".service-waiter")
	}

	viper.AutomaticEnv() // read in environment variables that match

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		fmt.Println("Using config file:", viper.ConfigFileUsed())
	}
}

func getTimeout() time.Duration {
	t := viper.GetString("timeout")
	timeout, err := time.ParseDuration(t)
	if err != nil {
		log.WithError(err).Fatal("cannot parse timeout")
	}

	return timeout
}

// fail ends the waiting process propagating the message on its way out
func fail(message string) {
	terminationLog := "/dev/termination-log"

	log.WithField("message", message).Warn("failed to wait for a service")

	if _, err := os.Stat(terminationLog); !os.IsNotExist(err) {
		err := os.WriteFile(terminationLog, []byte(message), 0600)
		if err != nil {
			log.WithError(err).Error("cannot write termination log")
		}
	}

	os.Exit(1)
}

func envOrDefault(env, def string) (res string) {
	res = os.Getenv(env)
	if res == "" {
		res = def
	}

	return
}
