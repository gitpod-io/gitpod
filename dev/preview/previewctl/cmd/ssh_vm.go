// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

func newSSHPreviewCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "ssh",
		Short: "SSH into a preview's Virtual Machine.",
		RunE: func(cmd *cobra.Command, args []string) error {
			err := preview.SSHPreview(branch)
			if err != nil {
				logger.WithFields(logrus.Fields{"err": err}).Fatal("Failed to SSH preview's VM.")
			}

			return err
		},
	}

	return cmd
}
