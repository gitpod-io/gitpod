// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/shiftfs"
	"github.com/spf13/cobra"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

func authClusterOrKubeconfig(kubeconfig string) (*rest.Config, error) {
	// Try authenticating in-cluster with serviceaccount
	config, err := rest.InClusterConfig()
	if err != nil {
		// Try authenticating out-of-cluster with kubeconfig
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, err
		}
	}

	return config, nil
}

// configDetectClusterShiftfsCmd represents the validate command
var configDetectClusterShiftfsCmd = &cobra.Command{
	Use:   "shiftfs",
	Short: "Detects if a cluster can support ShiftFS",
	RunE: func(cmd *cobra.Command, args []string) error {
		// @todo(sje): remove
		_, _, cfg, err := loadConfig("./example-config.yaml")
		if err != nil {
			return err
		}

		versionMF, err := getVersionManifest()
		if err != nil {
			return err
		}

		gitpodCtx, err := common.NewRenderContext(*cfg, *versionMF, configDetectClusterOpts.Namespace)
		if err != nil {
			return err
		}

		config, err := authClusterOrKubeconfig(configDetectClusterOpts.Kube.Config)
		if err != nil {
			return err
		}

		clientset, err := kubernetes.NewForConfig(config)
		if err != nil {
			return err
		}

		// @todo(sje): change serviceaccount name
		supported, err := shiftfs.IsSupported(gitpodCtx, "installer", clientset)
		if err != nil {
			return nil
		}

		if *supported {
			fmt.Println("yay, it's supported")
		} else {
			fmt.Println("oh well, fuse ain't too bad")
		}

		return nil
	},
}

func init() {
	configDetectClusterCmd.AddCommand(configDetectClusterShiftfsCmd)
}
