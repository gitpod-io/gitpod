// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

func newGetCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get",
		Short: "",
		RunE: func(cmd *cobra.Command, args []string) error {
			return nil
		},
	}

	cmd.AddCommand(
		newGetNameSubCmd(),
	)

	return cmd
}

func newGetNameSubCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "name",
		Short: "",
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
