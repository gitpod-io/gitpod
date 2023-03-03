// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/containerd"
	"github.com/spf13/cobra"
)

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

		containerd, socket, err := containerd.Detect(configFilesOpts.MountPath)
		if err != nil {
			return err
		}
		log.Infof("containerd location detected as %s", *containerd)
		log.Infof("containerd socket location detected as %s", *socket)

		cfg.Workspace.Runtime.ContainerDRuntimeDir = containerd.String()
		cfg.Workspace.Runtime.ContainerDSocketDir = socket.String()

		return saveConfigFile(cfg)
	},
}

func init() {
	configFilesCmd.AddCommand(configNodeContainerdCmd)
}
