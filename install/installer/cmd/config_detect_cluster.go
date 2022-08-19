// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"k8s.io/client-go/util/homedir"
)

var configDetectClusterOpts struct {
	Kube      kubeConfig
	Namespace string
}

// configDetectClusterCmd represents the validate command
var configDetectClusterCmd = &cobra.Command{
	Use:   "cluster",
	Short: "Performs detection tasks on a cluster",
}

func init() {
	configDetectCmd.AddCommand(configDetectClusterCmd)

	configDetectClusterCmd.PersistentFlags().StringVar(&configDetectClusterOpts.Kube.Config, "kubeconfig", fmt.Sprintf("%s/.kube/config", homedir.HomeDir()), "path to the kubeconfig file")
	configDetectClusterCmd.PersistentFlags().StringVarP(&configDetectClusterOpts.Namespace, "namespace", "n", "default", "namespace to deploy to")
}
