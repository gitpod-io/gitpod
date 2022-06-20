// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

func SSHPreviewCmd(logger *logrus.Logger) *cobra.Command {

	cmd := &cobra.Command{
		Use:   "ssh",
		Short: "SSH into a preview's Virtual Machine.",
		Run: func(cmd *cobra.Command, args []string) {
			p := preview.New(branch, logger)

			err := p.SSHPreview()
			if err != nil {
				logger.WithFields(logrus.Fields{"err": err}).Fatal("Failed to SSH preview's VM.")
			}
		},
	}

	return cmd
}
