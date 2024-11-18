// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"os/exec"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"

	"context"

	"github.com/google/shlex"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

// initCmd represents the init command
var openCmd = &cobra.Command{
	Use:   "open <filename>",
	Short: "Opens a file in Gitpod",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO(ak) use NotificationService.NotifyActive supervisor API instead

		ctx, cancel := context.WithTimeout(cmd.Context(), 10*time.Second)
		defer cancel()

		client, err := supervisor.New(ctx)
		if err != nil {
			return err
		}
		defer client.Close()

		client.WaitForIDEReady(ctx)

		wait, _ := cmd.Flags().GetBool("wait")

		pcmd := os.Getenv("GP_OPEN_EDITOR")
		if pcmd == "" {
			return xerrors.Errorf("GP_OPEN_EDITOR is not set")
		}
		pargs, err := shlex.Split(pcmd)
		if err != nil {
			return xerrors.Errorf("cannot parse GP_OPEN_EDITOR: %w", err)
		}
		if len(pargs) > 1 {
			pcmd = pargs[0]
		}
		pcmd, err = exec.LookPath(pcmd)
		if err != nil {
			return err
		}

		if wait {
			pargs = append(pargs, "--wait")
			ctx = cmd.Context()
		}
		c := exec.CommandContext(ctx, pcmd, append(pargs[1:], args...)...)
		c.Stdin = os.Stdin
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		err = c.Run()
		if err != nil {
			if ctx.Err() != nil {
				return xerrors.Errorf("editor failed to open in time: %w", ctx.Err())
			}

			return xerrors.Errorf("editor failed to open: %w", err)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(openCmd)
	openCmd.Flags().BoolP("wait", "w", false, "wait until all opened files are closed again")
}
