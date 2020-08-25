// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
	"github.com/spf13/cobra"
)

// initCmd represents the init command
var openCmd = &cobra.Command{
	Use:   "open <filename>",
	Short: "Opens a file in Gitpod",
	Long:  ``,
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		wait, _ := cmd.Flags().GetBool("wait")

		service, err := theialib.NewServiceFromEnv()
		if err != nil {
			log.Fatal(err)
		}

		var wg sync.WaitGroup
		for _, fn := range args {
			_, err := service.OpenFile(theialib.OpenFileRequest{Path: fn})
			if err != nil {
				log.Println(err)
				continue
			}

			if wait {
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
		}

		wg.Wait()
	},
}

func init() {
	rootCmd.AddCommand(openCmd)
	openCmd.Flags().BoolP("wait", "w", false, "wait until all opened files are closed again")
}
