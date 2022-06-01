// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"net/url"

	"github.com/heroku/docker-registry-client/registry"
	"github.com/spf13/cobra"
)

var verifyCmd = &cobra.Command{
	Use:   "verify <url> <username> <password>",
	Short: "Verifies the connection parameters",
	Args: func(cmd *cobra.Command, args []string) error {
		err := cobra.ExactValidArgs(3)(cmd, args)
		if err != nil {
			return err
		}

		registryUrl := args[0]

		u, _ := url.Parse(registryUrl)
		if u.Scheme == "" {
			args[0] = "https://" + registryUrl
		}

		if err != nil {
			return err
		}

		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		registryUrl := args[0]
		username := args[1]
		password := args[2]

		_, err := registry.New(registryUrl, username, password)
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(verifyCmd)
}
