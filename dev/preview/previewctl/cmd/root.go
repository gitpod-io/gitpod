// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	branch   = ""
	logLevel = ""
)

func NewRootCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use: "previewctl",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			lvl, err := logrus.ParseLevel(logLevel)
			if err != nil {
				return err
			}

			logger.SetLevel(lvl)

			return nil
		},
		Short: "Your best friend when interacting with Preview Environments :)",
		Long:  `previewctl is your best friend when interacting with Preview Environments :)`,
	}

	cmd.PersistentFlags().StringVar(&branch, "branch", "", "From which branch's preview previewctl should interact with. By default it will use the result of \"git rev-parse --abbrev-ref HEAD\"")
	cmd.PersistentFlags().StringVar(&logLevel, "log-level", "info", "The logger's log level")

	cmd.AddCommand(
		newInstallContextCmd(logger),
		newGetNameCmd(),
		newListPreviewsCmd(logger),
		newSSHPreviewCmd(logger),
		newGetCredentialsCommand(logger),
	)

	return cmd
}
