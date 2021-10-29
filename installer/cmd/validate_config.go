// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
	"os"
	"strings"
)

var validateConfigOpts struct {
	Config string
}

// validateConfigCmd represents the cluster command
var validateConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Validate the deployment configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		_, cfgVersion, cfg, err := loadConfig(validateConfigOpts.Config)
		if err != nil {
			return err
		}

		if err = runConfigValidation(cfgVersion, cfg); err != nil {
			return err
		}

		fmt.Println("Gitpod installer configuration valid")

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

	validationErrs, err := config.Validate(apiVersion, cfg)
	if err != nil {
		return err
	}

	if len(validationErrs) > 0 {
		for _, v := range validationErrs {
			switch v.Tag() {
			case "required":
				fmt.Printf("Field '%s' is required", v.Namespace())
			case "required_if", "required_unless", "required_with":
				tag := strings.Replace(v.Tag(), "_", " ", -1)
				fmt.Printf("Field '%s' is %s '%s'", v.Namespace(), tag, v.Param())
			case "startswith":
				fmt.Printf("Field '%s' must start with '%s'", v.Namespace(), v.Param())
			default:
				// General error message
				fmt.Printf("Field '%s' failed %s validation", v.Namespace(), v.Tag())
			}
		}
		return fmt.Errorf("configuration invalid")
	}

	return nil
}

func init() {
	validateCmd.AddCommand(validateConfigCmd)

	validateCmd.PersistentFlags().StringVarP(&validateConfigOpts.Config, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
}
