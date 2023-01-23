// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"time"

	"github.com/spf13/cobra"
)

const (
	fnNetTCP  = "/proc/net/tcp"
	fnNetTCP6 = "/proc/net/tcp6"
)

var awaitPortCmd = &cobra.Command{
	Use:   "await <port>",
	Short: "Waits for a process to listen on a port",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()

		port, err := strconv.ParseUint(args[0], 10, 16)
		if err != nil {
			gpErr := &GpError{
				Err: fmt.Errorf("port cannot be parsed as int: %s", err),
			}
			cmd.SetContext(context.WithValue(ctx, ctxKeyError, gpErr))
		}

		// Expected format: local port (in hex), remote address (irrelevant here), connection state ("0A" is "TCP_LISTEN")
		pattern, err := regexp.Compile(fmt.Sprintf(":[0]*%X \\w+:\\w+ 0A ", port))
		if err != nil {
			gpErr := &GpError{
				Err: fmt.Errorf("cannot compile regexp pattern"),
			}
			cmd.SetContext(context.WithValue(ctx, ctxKeyError, gpErr))
		}

		var protos []string
		for _, path := range []string{fnNetTCP, fnNetTCP6} {
			if _, err := os.Stat(path); err == nil {
				protos = append(protos, path)
			}
		}

		fmt.Printf("Awaiting port %d... ", port)
		for {
			for _, proto := range protos {
				tcp, err := os.ReadFile(proto)
				if err != nil {
					log.Fatalf("cannot read %v: %s", proto, err)
				}

				if pattern.MatchString(string(tcp)) {
					fmt.Println("ok")
					return
				}
			}

			time.Sleep(2 * time.Second)
		}
	},
}

var awaitPortCmdAlias = &cobra.Command{
	Hidden:     true,
	Deprecated: "please use `ports await` instead.",
	Use:        "await-port <port>",
	Short:      awaitPortCmd.Short,
	Long:       awaitPortCmd.Long,
	Args:       awaitPortCmd.Args,
	Run:        awaitPortCmd.Run,
}

func init() {
	portsCmd.AddCommand(awaitPortCmd)

	rootCmd.AddCommand(awaitPortCmdAlias)
}
