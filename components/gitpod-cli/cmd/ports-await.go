// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

const (
	fnNetTCP  = "/proc/net/tcp"
	fnNetTCP6 = "/proc/net/tcp6"
)

var awaitPortCmd = &cobra.Command{
	Use:   "await <port>",
	Short: "Waits for a process to listen on a port",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		port, err := strconv.ParseUint(args[0], 10, 16)
		if err != nil {
			return GpError{Err: xerrors.Errorf("port cannot be parsed as int: %w", err), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		// Expected format: local port (in hex), remote address (irrelevant here), connection state ("0A" is "TCP_LISTEN")
		pattern, err := regexp.Compile(fmt.Sprintf(":[0]*%X \\w+:\\w+ 0A ", port))
		if err != nil {
			return GpError{Err: xerrors.Errorf("cannot compile regexp pattern"), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		var protos []string
		for _, path := range []string{fnNetTCP, fnNetTCP6} {
			if _, err := os.Stat(path); err == nil {
				protos = append(protos, path)
			}
		}

		fmt.Printf("Awaiting port %d... ", port)
		t := time.NewTicker(time.Second * 2)
		for cmd.Context().Err() == nil {
			for _, proto := range protos {
				tcp, err := os.ReadFile(proto)
				if err != nil {
					return xerrors.Errorf("cannot read %v: %w", proto, err)
				}

				if pattern.MatchString(string(tcp)) {
					fmt.Println("ok")
					return nil
				}
			}
			select {
			case <-cmd.Context().Done():
				return nil
			case <-t.C:
			}
		}
		return nil
	},
}

var awaitPortCmdAlias = &cobra.Command{
	Hidden:     true,
	Deprecated: "please use `ports await` instead.",
	Use:        "await-port <port>",
	Short:      awaitPortCmd.Short,
	Long:       awaitPortCmd.Long,
	Args:       awaitPortCmd.Args,
	RunE:       awaitPortCmd.RunE,
}

func init() {
	portsCmd.AddCommand(awaitPortCmd)

	rootCmd.AddCommand(awaitPortCmdAlias)
}
