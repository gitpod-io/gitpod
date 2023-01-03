// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/heroku/docker-registry-client/registry"
	"github.com/spf13/cobra"
)

var checkOpts struct {
	Username      string
	Password      string
	ServerAddress string
	InCluster     bool
}

// @link https://cloud.google.com/container-registry/docs/pushing-and-pulling#add-registry
var gcpUrls = []string{
	"gcr.io",
	"asia.gcr.io",
	"eu.gcr.io",
	"us.gcr.io",
}

// Google registries must use the hostname for the authentication to be accurately checked
func checkGoogleAddress(address *url.URL, googleRegistry string) error {
	if strings.HasPrefix(address.Path, googleRegistry) && address.Path != googleRegistry {
		return fmt.Errorf("google container registries must use the address %s, not %s", googleRegistry, address.Path)
	}

	return nil
}

var checkCmd = &cobra.Command{
	Use:   "check",
	Short: "Checks registry connection",
	RunE: func(cmd *cobra.Command, args []string) error {
		if !checkOpts.InCluster {
			serverAddress, err := url.Parse(checkOpts.ServerAddress)
			if err != nil {
				return err
			}
			if serverAddress.Scheme == "" {
				// If no scheme, default to HTTPS
				serverAddress.Scheme = "https"
			}

			for _, url := range gcpUrls {
				if err := checkGoogleAddress(serverAddress, url); err != nil {
					return err
				}
			}

			_, err = registry.New(serverAddress.String(), checkOpts.Username, checkOpts.Password)
			if err != nil {
				return err
			}
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(checkCmd)

	checkCmd.Flags().StringVarP(&checkOpts.Username, "username", "u", "", "Registry username")
	checkCmd.Flags().StringVarP(&checkOpts.Password, "password", "p", "", "Registry password")
	checkCmd.Flags().StringVarP(&checkOpts.ServerAddress, "server-address", "s", "", "Registry server address")
	checkCmd.Flags().BoolVar(&checkOpts.InCluster, "in-cluster", false, "Registry in-cluster")
}
