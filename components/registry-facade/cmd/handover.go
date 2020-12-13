// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/registry-facade/pkg/registry"
	"github.com/spf13/cobra"
)

// debugHandover represents the run command
var debugHandover = &cobra.Command{
	Use:   "handover <socket-dir>",
	Short: "Attempts to get the listener socket from a registry-facade - and offers it back up for someone else",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		l, err := registry.ReceiveHandover(ctx, args[0])
		if err != nil {
			return err
		}
		if l == nil {
			log.Warn("received no listener")
			return nil
		}

		log.Info("handover successfull - holding listener for someone else")

		hoctx, cancelHO := context.WithCancel(context.Background())
		defer cancelHO()

		ho, err := registry.OfferHandover(hoctx, args[0], l, nil)
		if err != nil {
			return err
		}

		log.Info("waiting for someone else to handover to - stop with Ctrl+C")
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

		select {
		case didHO := <-ho:
			if didHO {
				<-ho
			}
		case <-sigChan:
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(debugHandover)
}
