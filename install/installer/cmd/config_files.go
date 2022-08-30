// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// configFilesCmd represents the validate command
var configFilesCmd = &cobra.Command{
	Use:   "files",
	Short: "Perform configuration tasks against the cluster's file system",
	Long: `Perform configuration tasks against the cluster's file system

These can be run either on the cluster nodes or by mounting volumes to a pod.`,
}

func init() {
	configCmd.AddCommand(configFilesCmd)

	configFilesCmd.PersistentFlags().StringVar(&configClusterContainerdOpts.MountPath, "mount-path", getEnvvar("MOUNT_PATH", "/"), "")
}
