// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/gitpod-io/local-app/pkg/constants"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/gitpod-io/local-app/pkg/selfupdate"
	"github.com/sagikazarmark/slog-shim"
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
			Latest    string `print:"latest"`
		}
		v := Version{
			Version:   constants.Version.String(),
			GitCommit: constants.GitCommit,
			BuildTime: constants.MustParseBuildTime().Format(time.RFC3339),
			Latest:    "<not available>",
		}

		if !versionOpts.DontCheckLatest {
			dlctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
			defer cancel()

			mf, err := selfupdate.DownloadManifestFromActiveContext(dlctx)
			if err != nil {
				slog.Debug("cannot download manifest", "err", err)
			}
			if mf != nil {
				v.Latest = mf.Version.String()
			}
		}

		return WriteTabular([]Version{v}, formatOpts{}, prettyprint.WriterFormatNarrow)
	},
}

var versionOpts struct {
	DontCheckLatest bool
}

func init() {
	rootCmd.AddCommand(versionCmd)
	versionCmd.Flags().BoolVar(&versionOpts.DontCheckLatest, "dont-check-latest", false, "Don't check for the latest available version")
}
