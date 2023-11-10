// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"time"

	"github.com/gitpod-io/local-app/pkg/constants"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Prints the CLI version",
	RunE: func(cmd *cobra.Command, args []string) error {
		type Version struct {
			Version   string `print:"version"`
			GitCommit string `print:"commit"`
			BuildTime string `print:"built at"`
		}
		v := Version{
			Version:   constants.Version.String(),
			GitCommit: constants.GitCommit,
			BuildTime: constants.MustParseBuildTime().Format(time.RFC3339),
		}
		return WriteTabular([]Version{v}, formatOpts{}, prettyprint.WriterFormatNarrow)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
