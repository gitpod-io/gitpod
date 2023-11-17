// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"log/slog"

	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var configContextDeleteCmd = &cobra.Command{
	Use:   "delete <name>",
	Short: "Deletes a context",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		cmd.SilenceUsage = true

		targetContext := args[0]
		cfg := config.FromContext(cmd.Context())

		var update bool
		defer func() {
			if err == nil && update {
				slog.Debug("saving config", "filename", cfg.Filename)
				err = config.SaveConfig(cfg.Filename, cfg)
			}
		}()

		if cfg.ActiveContext == targetContext {
			slog.Info("deleting active context - use `gitpod config use-context` to set a new active context")
			cfg.ActiveContext = ""
			update = true
		}

		gpctx := cfg.Contexts[targetContext]
		if gpctx == nil {
			return nil
		}
		delete(cfg.Contexts, targetContext)
		update = true

		err = auth.DeleteToken(gpctx.Host.String())
		if err != nil {
			slog.Warn("did not delete token from keyring", "err", err)
			err = nil
		}

		return nil
	},
}

func init() {
	configContextCmd.AddCommand(configContextDeleteCmd)
}
