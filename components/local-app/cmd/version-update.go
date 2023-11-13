// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/constants"
	"github.com/gitpod-io/local-app/pkg/selfupdate"
	"github.com/sagikazarmark/slog-shim"
	"github.com/spf13/cobra"
)

var versionUpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Updates the CLI to the latest version",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		dlctx, cancel := context.WithTimeout(cmd.Context(), 30*time.Second)
		defer cancel()

		cfg := config.FromContext(cmd.Context())
		gpctx, err := cfg.GetActiveContext()
		if err != nil {
			return err
		}

		mf, err := selfupdate.DownloadManifest(dlctx, gpctx.Host.URL.String())
		if err != nil {
			return err
		}
		if !selfupdate.NeedsUpdate(constants.Version, mf) {
			slog.Info("already up to date")
			return nil
		}

		slog.Info("updating to latest version " + mf.Version.String())
		err = selfupdate.ReplaceSelf(dlctx, mf)
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	versionCmd.AddCommand(versionUpdateCmd)
}
