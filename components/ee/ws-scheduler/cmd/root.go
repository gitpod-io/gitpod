// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scaler"
	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-scheduler"
	// Version of this service - set during build
	Version = ""
)

var cfgFile string
var kubeconfig string
var jsonLog bool
var verbose bool

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "ws-scheduler",
	Short: "ws-scheduler schedules workspace pods to nodes",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, verbose)
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
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.kedgei.yaml)")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")

	rootCmd.PersistentFlags().StringVar(&kubeconfig, "kubeconfig", "", "path to the kubeconfig file to use (defaults to in-cluster config)")
}

func getConfig() *config {
	ctnt, err := os.ReadFile(cfgFile)
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
	Scheduler scheduler.Configuration `json:"scheduler"`
	Scaler    struct {
		Enabled    bool                                        `json:"enabled"`
		Driver     scaler.WorkspaceManagerPrescaleDriverConfig `json:"driver"`
		Controller scaler.ControllerConfig                     `json:"controller"`
	}
	Prometheus struct {
		Addr string `json:"addr"`
	} `json:"prometheus"`
	PProf struct {
		Addr string `json:"addr"`
	} `json:"pprof"`
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
