// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/spf13/cobra"
)

// completionCmd represents the completion command
var completionCmd = &cobra.Command{
	Use:    "completion",
	Hidden: true,
	Short:  "Generates bash completion scripts",
	Long: `To load completion run

. <(gp completion)

To configure your bash shell to load completions for each session add to your bashrc

# ~/.bashrc or ~/.profile
. <(gp completion)
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// ignore trace
		utils.TrackCommandUsageEvent.Command = nil

		_ = rootCmd.GenBashCompletion(os.Stdout)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(completionCmd)
}
