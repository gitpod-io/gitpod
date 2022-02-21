// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
)

var validateConfigOpts struct {
	Config string
}

// validateConfigCmd represents the cluster command
var validateConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Validate the deployment configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		if validateConfigOpts.Config == "" {
			log.Fatal("missing --config")
		}
		_, cfgVersion, cfg, err := loadConfig(validateConfigOpts.Config)
		if err != nil {
			return err
		}

		if err = runConfigValidation(cfgVersion, cfg); err != nil {
			return err
		}

		return nil
	},
}

// runConfigValidation this will run the validation and print any validation errors
// It's silent if everything is fine
func runConfigValidation(version string, cfg interface{}) error {
	apiVersion, err := config.LoadConfigVersion(version)
	if err != nil {
		return err
	}

	res, err := config.Validate(apiVersion, cfg)
	if err != nil {
		return err
	}
	res.Marshal(os.Stdout)
	if len(res.Fatal) > 0 {
		return fmt.Errorf("configuration invalid")
	}

	return nil
}

func init() {
	validateCmd.AddCommand(validateConfigCmd)

	validateCmd.PersistentFlags().StringVarP(&validateConfigOpts.Config, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
}
