// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// imagebuildsResolveCmd represents the imagebuildsResolve command
var imagebuildsResolveCmd = &cobra.Command{
	Use:   "resolve",
	Short: "Resolves a base or workspace image",
	Args:  cobra.ExactArgs(1),
}

func init() {
	imagebuildsCmd.AddCommand(imagebuildsResolveCmd)
}
