// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

func newListPreviewsCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all existing Config Environments.",
	}

	cmd.AddCommand(
		newListWorkspacesCmd(logger),
		newListStaleCmd(logger),
	)

	return cmd
}
