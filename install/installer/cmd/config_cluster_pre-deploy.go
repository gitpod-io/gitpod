// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
)

var configClusterPreDeployOpts struct{}

// configClusterPreDeployCmd represents the validate command
var configClusterPreDeployCmd = &cobra.Command{
	Use:   "pre-deploy",
	Short: "sss",
	RunE: func(cmd *cobra.Command, args []string) error {
		if _, err := configFileExistsAndInit(); err != nil {
			return err
		}

		_, version, cfg, err := loadConfig(configOpts.ConfigFile)
		if err != nil {
			return err
		}

		apiVersion, err := config.LoadConfigVersion(version)
		if err != nil {
			return err
		}

		_, clientset, err := authClusterOrKubeconfig(configClusterOpts.Kube.Config)
		if err != nil {
			return err
		}

		if err := apiVersion.PreDeploy(cfg, clientset, configClusterOpts.Namespace); err != nil {
			return err
		}

		return saveConfigFile(cfg)
	},
}

func init() {
	configClusterCmd.AddCommand(configClusterPreDeployCmd)
}
