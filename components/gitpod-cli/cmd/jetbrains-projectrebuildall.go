// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var jetBrainsProjectRebuildAllCmd = &cobra.Command{
	Use:   "project-rebuild-all",
	Short: "Interact with Gitpod's OIDC identity provider",
	RunE: func(cmd *cobra.Command, args []string) error {
		return callJetBrainsBackendCLI(cmd.Context(), operatorProjectRebuildAll, nil)
	},
}

func init() {
	jetBrainsCmd.AddCommand(jetBrainsProjectRebuildAllCmd)
}
