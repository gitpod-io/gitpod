// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var configContextCmd = &cobra.Command{
	Use:     "context",
	Aliases: []string{"contexts", "ctx"},
	Short:   "Interact with the CLI's contexts - if you don't know what this means, you probably don't need it",
}

func init() {
	configCmd.AddCommand(configContextCmd)
}
