// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	_ "embed"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
)

var migrateOpts struct {
	ConfigFN string
}

// migrateCmd represents the render command
var migrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Migrates one config version to another",
	RunE: func(cmd *cobra.Command, args []string) error {
		rawCfg, cfgVersion, err := config.Load(migrateOpts.ConfigFN)
		if err != nil {
			return fmt.Errorf("error loading config: %w", err)
		}

		newCfg, err := config.NewDefaultConfig()
		if err != nil {
			return err
		}

		err = config.Migrate(cfgVersion, config.CurrentVersion, rawCfg, newCfg)
		if err != nil {
			return err
		}

		out, err := config.Marshal(config.CurrentVersion, newCfg)
		if err != nil {
			return err
		}

		fmt.Println(string(out))

		return nil
	},
}

func init() {
	rootCmd.AddCommand(migrateCmd)

	migrateCmd.PersistentFlags().StringVarP(&migrateOpts.ConfigFN, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
}
