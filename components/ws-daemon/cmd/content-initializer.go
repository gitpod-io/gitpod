// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
)

// contentInitializerCmd creates a workspace snapshot
var contentInitializerCmd = &cobra.Command{
	Use:   "content-initializer",
	Short: "fork'ed by ws-daemon to initialize content",
	Args:  cobra.ExactArgs(0),
	RunE: func(cmd *cobra.Command, args []string) error {
		return content.RunInitializerChild()
	},
}

func init() {
	clientCmd.AddCommand(contentInitializerCmd)
}
