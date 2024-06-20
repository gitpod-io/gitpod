// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	ide_service "github.com/gitpod-io/gitpod/installer/pkg/components/ide-service"

	"github.com/spf13/cobra"
)

var ideOpts struct {
	ConfigFN              string
	Namespace             string
	UseExperimentalConfig bool
}

// ideConfigmapCmd generates ide-configmap.json
var ideConfigmapCmd = &cobra.Command{
	Use:    "ide-configmap",
	Hidden: true,
	Short:  "render ide-configmap.json",
	RunE: func(cmd *cobra.Command, args []string) error {
		renderCtx, err := getRenderCtx(ideOpts.ConfigFN, ideOpts.Namespace, ideOpts.UseExperimentalConfig)
		if err != nil {
			return err
		}

		ideConfig, err := ide_service.GenerateIDEConfigmap(renderCtx)
		if err != nil {
			return err
		}

		fc, err := common.ToJSONString(ideConfig)
		if err != nil {
			return fmt.Errorf("failed to marshal ide-config config: %w", err)
		}

		fmt.Println(string(fc))
		return nil
	},
}

func getRenderCtx(configFN, namespace string, useExperimentalConfig bool) (*common.RenderContext, error) {
	_, _, cfg, err := loadConfig(configFN)
	if err != nil {
		return nil, err
	}

	if cfg.Experimental != nil {
		if useExperimentalConfig {
			fmt.Fprintf(os.Stderr, "rendering using experimental config\n")
		} else {
			fmt.Fprintf(os.Stderr, "ignoring experimental config. Use `--use-experimental-config` to include the experimental section in config\n")
			cfg.Experimental = nil
		}
	}
	versionMF, err := getVersionManifest()
	if err != nil {
		return nil, err
	}
	return common.NewRenderContext(*cfg, *versionMF, namespace)
}

func init() {
	rootCmd.AddCommand(ideConfigmapCmd)

	dir, err := os.Getwd()
	if err != nil {
		log.WithError(err).Fatal("Failed to get working directory")
	}

	ideConfigmapCmd.PersistentFlags().StringVarP(&ideOpts.ConfigFN, "config", "c", getEnvvar("GITPOD_INSTALLER_CONFIG", filepath.Join(dir, "gitpod.config.yaml")), "path to the config file, use - for stdin")
	ideConfigmapCmd.PersistentFlags().StringVarP(&ideOpts.Namespace, "namespace", "n", getEnvvar("NAMESPACE", "default"), "namespace to deploy to")
	ideConfigmapCmd.Flags().BoolVar(&ideOpts.UseExperimentalConfig, "use-experimental-config", false, "enable the use of experimental config that is prone to be changed")
}
