// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

func getNameCmd(logger *logrus.Logger) *cobra.Command {

	cmd := &cobra.Command{
		Use:   "get-name",
		Short: "Returns the name of the preview for the corresponding branch.",
		Run: func(cmd *cobra.Command, args []string) {
			p := preview.New(branch, logger)

			fmt.Println(p.GetPreviewName())
		},
	}

	return cmd
}
