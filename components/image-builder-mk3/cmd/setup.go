// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"os/exec"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Updates the CA certificates",
	Run: func(cmd *cobra.Command, args []string) {
		log.Info("Updating CA certificates...")
		shCmd := exec.Command("update-ca-certificates", "-f")
		shCmd.Stdin = os.Stdin
		shCmd.Stderr = os.Stderr
		shCmd.Stdout = os.Stdout

		err := shCmd.Run()
		if err != nil {
			log.Fatalf("cannot update CA certificates: %v", err)
		}
	},
}

func init() {
	rootCmd.AddCommand(setupCmd)
}
