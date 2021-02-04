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

var handoverOpts struct {
	SocketDir string
	Config    string
	Debug     bool
}

// handoverCmd represents the run command
var handoverCmd = &cobra.Command{
	Use:   "handover --sockets <socket-dir> | --config <config.json>",
	Short: "Attempts to get the listener socket from a registry-facade - and offers it back up for someone else",
	Args:  cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		log.Init("registry-facade-handover", "", true, true)

		if handoverOpts.Debug {
			defer func() {
				log.Warn("sleeping for 5min for debugging")
				time.Sleep(5 * time.Minute)
			}()
		}

		socketDir := handoverOpts.SocketDir
		if handoverOpts.Config != "" {
			cfg, err := getConfig(handoverOpts.Config)
			if err != nil {
				log.WithError(err).Error("cannot load config")
				return
			}
			if !cfg.Registry.Handover.Enabled {
				log.Error("handover not enabled")
				return
			}
			socketDir = cfg.Registry.Handover.Sockets
		}
		if socketDir == "" {
			log.Error("missing socket directory - provide either --sockets or --config")
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		l, err := registry.ReceiveHandover(ctx, socketDir)
		if err != nil {
			log.WithError(err).Error("cannot receive handover")
			return
		}
		if l == nil {
			log.Error("received no listener")
			return
		}

		log.Info("handover successfull - holding listener for someone else")

		hoctx, cancelHO := context.WithCancel(context.Background())
		defer cancelHO()

		ho, err := registry.OfferHandover(hoctx, socketDir, l, nil)
		if err != nil {
			log.WithError(err).Error("cannot offer handover")
			return
		}

		log.Info("waiting for someone else to handover to - stop with Ctrl+C")
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

		select {
		case didHO := <-ho:
			if didHO {
				<-ho
			}

			log.Info("handover happened - waiting for someone to shut us down (SIGTERM, SIGINT or SIGKILL)")
			<-sigChan
		case <-sigChan:
			return
		}

		return
	},
}

func init() {
	rootCmd.AddCommand(handoverCmd)
	handoverCmd.Flags().StringVar(&handoverOpts.SocketDir, "sockets", "", "connect to the latest socket from this directory")
	handoverCmd.Flags().StringVar(&handoverOpts.Config, "config", "", "read the socket directory from this config file")
	handoverCmd.Flags().BoolVar(&handoverOpts.Debug, "debug", false, "sleep when things go wrong")
}
