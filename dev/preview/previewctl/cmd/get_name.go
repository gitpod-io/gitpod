// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

func newGetNameCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get-name",
		Short: "Returns the name of the preview for the corresponding branch.",
		RunE: func(cmd *cobra.Command, args []string) error {
			previewName, err := preview.GetName(branch)
			if err != nil {
				return err
			}

			fmt.Println(previewName)

			return nil
		},
	}

	return cmd
}
