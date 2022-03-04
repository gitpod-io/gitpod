// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"time"

	"github.com/spf13/cobra"
)

var awaitPortCmd = &cobra.Command{
	Use:   "await-port <port>",
	Short: "Waits for a process to listen on a port",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		port, err := strconv.ParseUint(args[0], 10, 16)
		if err != nil {
			log.Fatalf("port cannot be parsed as int: %s", err)
		}

		// Expected format: local port (in hex), remote address (irrelevant here), connection state ("0A" is "TCP_LISTEN")
		pattern, err := regexp.Compile(fmt.Sprintf(":[0]*%X \\w+:\\w+ 0A ", port))
		if err != nil {
			log.Fatal("cannot compile regexp pattern")
		}

		fmt.Printf("Awaiting port %d... ", port)
		for {
			tcp, err := os.ReadFile("/proc/net/tcp")
			if err != nil {
				log.Fatalf("cannot read /proc/net/tcp: %s", err)
			}

			tcp6, err := os.ReadFile("/proc/net/tcp6")
			if err != nil {
				log.Fatalf("cannot read /proc/net/tcp6: %s", err)
			}

			if pattern.MatchString(string(tcp)) || pattern.MatchString(string(tcp6)) {
				break
			}

			time.Sleep(2 * time.Second)
		}

		fmt.Println("ok")
	},
}

func init() {
	rootCmd.AddCommand(awaitPortCmd)
}
