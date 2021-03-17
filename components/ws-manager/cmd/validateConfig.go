// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/alecthomas/repr"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// validateConfigCmd represents the validateConfig command
var validateConfigCmd = &cobra.Command{
	Use:   "validate-config",
	Short: "validates the wsman configuration",
	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		err := cfg.Manager.Validate()
		if err != nil {
			repr.Println(cfg)
			log.WithError(err).Fatal("configuration is invalid")
			return
		}

		log.Info("configuration is valid")
	},
}

func init() {
	rootCmd.AddCommand(validateConfigCmd)
}
