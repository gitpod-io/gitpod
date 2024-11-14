// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var jetbrainsGradleResumeCmd = &cobra.Command{
	Use:   "resume",
	Short: "Resume paused Gradle Sync",
	RunE: func(cmd *cobra.Command, args []string) error {
		err := os.Remove(gradleSyncLockFile)
		if err != nil && os.IsNotExist(err) {
			return nil
		}
		return err
	},
}

func init() {
	jetbrainsGradleCmd.AddCommand(jetbrainsGradleResumeCmd)
}
