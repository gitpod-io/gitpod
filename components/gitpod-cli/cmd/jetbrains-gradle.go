// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var jetbrainsGradleCmd = &cobra.Command{
	Use:   "gradle",
	Short: "Interact with JetBrains Gradle services.",
}

func init() {
	jetbrainsCmd.AddCommand(jetbrainsGradleCmd)
}
