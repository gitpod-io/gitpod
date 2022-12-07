// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/shiftfs"
	"github.com/spf13/cobra"
)

var configClusterShiftfsOpts struct {
	ServiceAccountName string
	Timeout            int
}

// configClusterShiftfsCmd represents the validate command
var configClusterShiftfsCmd = &cobra.Command{
	Use:   "shiftfs",
	Short: "Detects if a cluster can support ShiftFS",
	RunE: func(cmd *cobra.Command, args []string) error {
		if _, err := configFileExistsAndInit(); err != nil {
			return err
		}

		_, _, cfg, err := loadConfig(configOpts.ConfigFile)
		if err != nil {
			return err
		}

		versionMF, err := getVersionManifest()
		if err != nil {
			return err
		}

		gitpodCtx, err := common.NewRenderContext(*cfg, *versionMF, configClusterOpts.Namespace)
		if err != nil {
			return err
		}

		_, clientset, err := authClusterOrKubeconfig(configClusterOpts.Kube.Config)
		if err != nil {
			return err
		}

		log.Infof("Deploying ShiftFS check to %s namespace with timeout of %d seconds", configClusterOpts.Namespace, configClusterShiftfsOpts.Timeout)
		supported, err := shiftfs.IsSupported(
			gitpodCtx,
			configClusterShiftfsOpts.ServiceAccountName,
			clientset,
			time.Duration(configClusterShiftfsOpts.Timeout)*time.Second,
		)
		if err != nil {
			return err
		}

		if *supported {
			log.Info("ShiftFS is supported")
			cfg.Workspace.Runtime.FSShiftMethod = configv1.FSShiftShiftFS
		} else {
			log.Info("ShiftFS is not supported - use Fuse instead")
			cfg.Workspace.Runtime.FSShiftMethod = configv1.FSShiftFuseFS
		}

		return saveConfigFile(cfg)
	},
}

func init() {
	configClusterCmd.AddCommand(configClusterShiftfsCmd)

	configClusterShiftfsCmd.Flags().StringVar(&configClusterShiftfsOpts.ServiceAccountName, "serviceAccount", getEnvvar("SERVICE_ACCOUNT", "default"), "service account name to use for the job - this requires full cluster access")
	configClusterShiftfsCmd.Flags().IntVar(&configClusterShiftfsOpts.Timeout, "timeout", 10, "timeout in sec")
}
