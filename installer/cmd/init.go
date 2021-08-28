// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/spf13/cobra"
	"sigs.k8s.io/yaml"
)

// initCmd represents the init command
var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initializes a config file",
	Run: func(cmd *cobra.Command, args []string) {
		var cfg config.Config
		fc, err := yaml.Marshal(cfg)
		if err != nil {
			panic(err)
		}

		fmt.Print(string(fc))
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}
