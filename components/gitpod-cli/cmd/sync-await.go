// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
)

// awaitSyncCmd represents the awaitSync command
var awaitSyncCmd = &cobra.Command{
	Use:   "sync-await <name>",
	Short: "Awaits an event triggered using gp sync-done",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		h := sha1.New()
		h.Write([]byte(args[0]))
		id := hex.EncodeToString(h.Sum(nil))
		lockFile := fmt.Sprintf("/tmp/gp-%s.done", id)

		ticker := time.NewTicker(1 * time.Second)
		done := make(chan bool)
		go func() {
			for {
				if _, err := os.Stat(lockFile); !os.IsNotExist(err) {
					break
				}

				<-ticker.C
			}

			ticker.Stop()
			done <- true
		}()

		<-done
		fmt.Printf("%s done\n", args[0])
	},
}

func init() {
	rootCmd.AddCommand(awaitSyncCmd)
}
