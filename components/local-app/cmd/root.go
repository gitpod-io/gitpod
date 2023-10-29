// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "gitpod",
	Short: "A CLI for interacting with Gitpod",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		verbose, err := cmd.Flags().GetBool("verbose")
		if err != nil {
			slog.Error("Could not set up logging")
			os.Exit(1)
		}
		if verbose {
			var logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))
			slog.SetDefault(logger)
		} else {
			var logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
			slog.SetDefault(logger)
			return
		}
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	config.Init()
	slog.Debug("Configured configuration and environment variables")

	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Display verbose output for more detailed logging")
}
