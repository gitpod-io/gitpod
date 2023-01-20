// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"os"
	"os/exec"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"

	"github.com/google/shlex"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
)

// initCmd represents the init command
var openCmd = &cobra.Command{
	Use:   "open <filename>",
	Short: "Opens a file in Gitpod",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		// TODO(ak) use NotificationService.NotifyActive supervisor API instead

		ctx := cmd.Context()

		client := ctx.Value(ctxKeySupervisorClient).(*supervisor.SupervisorClient)

		// client, err := supervisor.New(ctx)
		// if err != nil {
		// 	log.Fatal(err)
		// }
		// defer client.Close()

		client.WaitForIDEReady(ctx)

		wait, _ := cmd.Flags().GetBool("wait")

		pcmd := os.Getenv("GP_OPEN_EDITOR")
		if pcmd == "" {
			log.Fatal("GP_OPEN_EDITOR is not set")
			return
		}
		pargs, err := shlex.Split(pcmd)
		if err != nil {
			log.Fatalf("cannot parse GP_OPEN_EDITOR: %v", err)
			return
		}
		if len(pargs) > 1 {
			pcmd = pargs[0]
		}
		pcmd, err = exec.LookPath(pcmd)
		if err != nil {
			log.Fatal(err)
		}

		if wait {
			pargs = append(pargs, "--wait")
		}

		err = unix.Exec(pcmd, append(pargs, args...), os.Environ())
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(openCmd)
	openCmd.Flags().BoolP("wait", "w", false, "wait until all opened files are closed again")
}
