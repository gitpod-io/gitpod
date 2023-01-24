// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"os/exec"
	"path/filepath"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/supervisor/api"

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
		ctx := cmd.Context()

		client, err := supervisor.New(ctx)
		if err != nil {
			return err
		}
		defer client.Close()
		client.WaitForIDEReady(ctx)

		wait, _ := cmd.Flags().GetBool("wait")

		pcmd := os.Getenv("GP_OPEN_EDITOR")
		if pcmd == "" {
			var paths []string
			for _, path := range args {
				absPath, err := filepath.Abs(path)
				if err == nil {
					path = absPath
				}
				paths = append(paths, path)
			}

			resp, err := client.Notification.Notify(ctx, &api.NotifyRequest{
				Open: &api.NotifyRequest_Open{
					Paths: paths,
					Await: wait,
				},
				Active: true,
			})
			if err != nil {
				return err
			}
			if resp.Command == nil {
				return nil
			}
			c := exec.CommandContext(cmd.Context(), resp.Command.Cmd, resp.Command.Args...)
			c.Stdin = os.Stdin
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			return c.Run()
		}
		// TODO: backward compatibilty, remove when all IDEs are updated
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
		}
		c := exec.CommandContext(cmd.Context(), pcmd, append(pargs[1:], args...)...)
		c.Stdin = os.Stdin
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		return c.Run()
	},
}

func init() {
	rootCmd.AddCommand(openCmd)
	openCmd.Flags().BoolP("wait", "w", false, "wait until all opened files are closed again")
}
