// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

const gradleSyncLockFile = "/tmp/gitpod-gradle.lock"

var jetbrainsGradlePauseCmd = &cobra.Command{
	Use:   "pause",
	Short: "Pause Gradle Sync in JetBrains IDEs",
	Long: `Pause JetBrains IDE gradle sync to prevent performance issues on Gitpod workspace startup when there's no Prebuilds ready.

This command is typically used to prevent concurrent Gradle syncs between:
- Manual gradle initialization in Gitpod init tasks
- JetBrains IDEs' (IDEA) automatic Gradle sync on project open

Typical usage in your .gitpod.yml:

tasks:
  - init: |
      gp jetbrains gradle pause          # Prevent JetBrains' gradle sync
	  ...
      ./gradlew <init_service>            # Run your initialization tasks
      gp jetbrains gradle resume         # Enable
    command: ./gradlew <dev_service>

If you have two init tasks want to pause Gradle Sync:

tasks:
  - name: Task 1
    init: |
      gp jetbrains gradle pause          # Prevent JetBrains' gradle sync
      ./gradlew <init_service>
      gp sync-await gradle-init-1
      gp jetbrains gradle resume         # Enable
  - name: Task 2
    init: |
      ./gradlew <init_service>
      gp sync-done gradle-init-1
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		err := os.WriteFile(gradleSyncLockFile, []byte{}, 0644)
		if err != nil && os.IsExist(err) {
			return nil
		}
		return err
	},
}

func init() {
	jetbrainsGradleCmd.AddCommand(jetbrainsGradlePauseCmd)
}
