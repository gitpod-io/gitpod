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
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

var logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))

func init() {
	config.Init()
	logger.Debug("Configured configuration and environment variables")

	rootCmd.Flags().BoolP("verbose", "v", false, "Display verbose output for more detailed logging")
}
