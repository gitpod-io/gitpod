// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/containerd"
	"github.com/spf13/cobra"
)

var configClusterContainerdOpts struct {
	MountPath string
}

// configNodeContainerdCmd represents the validate command
var configNodeContainerdCmd = &cobra.Command{
	Use:   "containerd",
	Short: "Detects the containerd settings for a cluster",
	RunE: func(cmd *cobra.Command, args []string) error {
		if _, err := configFileExistsAndInit(); err != nil {
			return err
		}

		_, _, cfg, err := loadConfig(configOpts.ConfigFile)
		if err != nil {
			return err
		}

		containerd, socket, err := containerd.Detect()
		if err != nil {
			return err
		}
		log.Infof("containerd location detected as %s", *containerd)
		log.Infof("containerd socket location detected as %s", *socket)

		cfg.Workspace.Runtime.ContainerDRuntimeDir = containerd.String()
		cfg.Workspace.Runtime.ContainerDSocket = socket.String()

		return saveConfigFile(cfg)
	},
}

func init() {
	configFilesCmd.AddCommand(configNodeContainerdCmd)
}
