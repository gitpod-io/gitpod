// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

// timeoutCmd commands collection
var timeoutCmd = &cobra.Command{
	Use:   "timeout",
	Short: "Interact with workspace timeout configuration",
}

func init() {
	rootCmd.AddCommand(timeoutCmd)
}
