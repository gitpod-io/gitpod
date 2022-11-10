// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

func newListPreviewsCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all existing Config Environments.",
		RunE: func(cmd *cobra.Command, args []string) error {
			p, err := preview.New("", logger)
			if err != nil {
				return err
			}

			err = p.ListAllPreviews(context.Background())
			if err != nil {
				logger.WithFields(logrus.Fields{"err": err}).Fatal("Failed to list previews.")
			}

			return nil
		},
	}

	return cmd
}
