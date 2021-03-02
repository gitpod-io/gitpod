// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"log"
	"os"

	"github.com/spf13/cobra"
)

// doneCmd represents the done command
var syncDoneCmd = &cobra.Command{
	Use:   "sync-done <name>",
	Short: "Notifies the corresponding gp sync-await calls that this event has happened",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		h := sha1.New()
		h.Write([]byte(args[0]))
		id := hex.EncodeToString(h.Sum(nil))
		lockFile := fmt.Sprintf("/tmp/gp-%s.done", id)

		if _, err := os.Stat(lockFile); !os.IsNotExist(err) {
			// file already exists - we're done
			return
		}

		err := os.WriteFile(lockFile, []byte("done"), 0600)
		if err != nil {
			log.Fatalf("cannot write lock file: %v", err)
		}
	},
}

func init() {
	rootCmd.AddCommand(syncDoneCmd)
}
