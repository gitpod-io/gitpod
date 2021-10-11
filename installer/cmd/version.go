// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"sigs.k8s.io/yaml"

	"github.com/spf13/cobra"
)

// versionCmd represents the version command
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display the version information",
	RunE: func(cmd *cobra.Command, args []string) error {
		var versionMF versions.Manifest
		err := yaml.Unmarshal(versionManifest, &versionMF)
		if err != nil {
			return err
		}

		versions, err := json.MarshalIndent(versionMF, "", "  ")
		if err != nil {
			return err
		}

		fmt.Println(string(versions))

		return nil
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
