// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/google/shlex"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
)

// initCmd represents the init command
var openCmd = &cobra.Command{
	Use:   "open <filename>",
	Short: "Opens a file in Gitpod",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		wait, _ := cmd.Flags().GetBool("wait")

		err := tryOpenInTheia(args, wait)
		if err == nil {
			// opening in Theia worked - we're good
			return
		}

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

func tryOpenInTheia(args []string, wait bool) error {
	service, err := theialib.NewServiceFromEnv()
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	for _, fn := range args {
		if fn == "--wait" {
			continue
		}

		_, err := service.OpenFile(theialib.OpenFileRequest{Path: fn})
		if err != nil {
			return err
		}
		if !wait {
			continue
		}

		wg.Add(1)
		go func(fn string) {
			defer wg.Done()

			for {
				resp, err := service.IsFileOpen(theialib.IsFileOpenRequest{Path: fn})
				if err != nil {
					log.Fatal(err)
					return
				}
				if !resp.IsOpen {
					return
				}

				time.Sleep(1 * time.Second)
			}
		}(fn)
	}

	wg.Wait()
	return nil
}
