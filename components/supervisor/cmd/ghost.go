// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var ghostCmd = &cobra.Command{
	Use:   "ghost",
	Short: "starts the supervisor",

	Run: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, true)
		log.Info("running as ghost - waiting for SIGINT")

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		select {
		case <-sigChan:
		}
	},
}

func init() {
	rootCmd.AddCommand(ghostCmd)
}
