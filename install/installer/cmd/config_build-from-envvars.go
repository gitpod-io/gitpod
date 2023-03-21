// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
)

// configBuildFromEnvvarsCmd represents the validate command
var configBuildFromEnvvarsCmd = &cobra.Command{
	Use:   "build-from-envvars",
	Short: "Build configuration from environment variables",
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

		if err := apiVersion.BuildFromEnvvars(cfg); err != nil {
			return err
		}

		return saveConfigFile(cfg)
	},
}

func init() {
	configCmd.AddCommand(configBuildFromEnvvarsCmd)
}
