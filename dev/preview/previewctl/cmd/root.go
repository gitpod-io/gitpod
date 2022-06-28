// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	branch = ""
)

func RootCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "previewctl",
		Short: "Your best friend when interacting with Preview Environments :)",
		Long:  `previewctl is your best friend when interacting with Preview Environments :)`,
	}

	cmd.PersistentFlags().StringVar(&branch, "branch", "", "From which branch's preview previewctl should interact with. By default it will use the result of \"git rev-parse --abbrev-ref HEAD\"")

	cmd.AddCommand(
		installContextCmd(logger),
		getNameCmd(),
		listPreviewsCmd(logger),
		SSHPreviewCmd(logger),
	)
	return cmd
}
