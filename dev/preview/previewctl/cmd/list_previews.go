// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

func listPreviewsCmd(logger *logrus.Logger) *cobra.Command {

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all existing Preview Environments.",
		Run: func(cmd *cobra.Command, args []string) {
			if branch != "" {
				logger.Warn("Branch flag is ignored for 'list' command.")
			}

			err := preview.ListAllPreviews()
			if err != nil {
				logger.WithFields(logrus.Fields{"err": err}).Fatal("Failed to list previews.")
			}
		},
	}

	return cmd
}
