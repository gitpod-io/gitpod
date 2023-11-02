// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"log/slog"
	"os"

	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var orgId string

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
			var logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
			slog.SetDefault(logger)
			return
		}
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	slog.Debug("Configured configuration and environment variables")

	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Display verbose output for more detailed logging")
	rootCmd.PersistentFlags().StringVarP(&orgId, "org-id", "o", "", "The organization to use")
}

func getOrganizationId() string {
	if orgId != "" {
		return orgId
	}

	orgFromConfig := config.GetString("org_id")
	if orgFromConfig != "" {
		return orgFromConfig
	}

	inferred, err := common.InferOrgId()
	if err != nil {
		slog.Warn("Could not get or infer an organization ID.", "error", err)
	}

	if inferred != "" {
		slog.Debug("Inferred organization ID", "orgId", inferred)
	}

	return inferred
}
