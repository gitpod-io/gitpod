// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/spf13/cobra"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"

	"github.com/gitpod-io/gitpod/poolkeeper/pkg/poolkeeper"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "poolkeeper"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var kubeconfig string
var jsonLog bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "poolkeeper",
	Short: "poolkeeper",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, jsonLog)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	closer := tracing.Init(ServiceName)
	if closer != nil {
		defer closer.Close()
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "v", false, "produce JSON log output on verbose level")

	rootCmd.PersistentFlags().StringVar(&kubeconfig, "kubeconfig", "", "path to the kubeconfig file to use (defaults to in-cluster config)")

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
	Poolkeeper poolkeeper.Config `json:"poolkeeper"`
}

func newClientSet() (*kubernetes.Clientset, error) {
	if kubeconfig != "" {
		res, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, err
		}
		res.RateLimiter = &wsk8s.UnlimitedRateLimiter{}
		return kubernetes.NewForConfig(res)
	}

	k8s, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}
	k8s.RateLimiter = &wsk8s.UnlimitedRateLimiter{}
	return kubernetes.NewForConfig(k8s)
}
