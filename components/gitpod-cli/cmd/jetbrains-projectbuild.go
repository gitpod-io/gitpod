// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"net/http"

	"github.com/spf13/cobra"
)

var jetBrainsProjectBuildCmd = &cobra.Command{
	Use:   "project-build",
	Short: "Interact with Gitpod's OIDC identity provider",
	RunE: func(cmd *cobra.Command, args []string) error {
		url := getJetBrainsBackendPluginCliApiUrl()
		query := url.Query()
		query.Add("op", "project-build")
		url.RawQuery = query.Encode()

		resp, err := http.Get(url.String())
		if err != nil {
			return err
		}
		if resp.StatusCode != http.StatusOK {
			body := []byte{}
			if _, err := resp.Body.Read(body); err != nil {
				return fmt.Errorf("unexpected status code: %d, read body failed: %w", resp.StatusCode, err)
			}
			return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
		}
		return nil
	},
}

func init() {
	jetBrainsCmd.AddCommand(jetBrainsProjectBuildCmd)
}
