// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"strconv"
	"time"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

var tunnelCmd = &cobra.Command{
	Use:   "tunnel <localPort> [targetPort] [visibility]",
	Short: "opens a new tunnel",
	Args:  cobra.RangeArgs(1, 3),
	Run: func(cmd *cobra.Command, args []string) {
		localPort, err := strconv.ParseUint(args[0], 10, 16)
		if err != nil {
			log.WithError(err).Fatal("invalid local port")
			return
		}
		targetPort := localPort
		if len(args) > 1 {
			targetPort, err = strconv.ParseUint(args[1], 10, 16)
			if err != nil {
				log.WithError(err).Fatal("invalid target port")
			}
		}
		visiblity := api.TunnelVisiblity_host
		if len(args) > 2 {
			visiblity = api.TunnelVisiblity(api.TunnelVisiblity_value[args[2]])
		}

		client := api.NewPortServiceClient(dialSupervisor())

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, err = client.Tunnel(ctx, &api.TunnelPortRequest{
			Port:       uint32(localPort),
			TargetPort: uint32(targetPort),
			Visibility: visiblity,
		})
		if err != nil {
			log.WithError(err).Fatal("cannot tunnel")
		}
	},
}

var closeTunnelCmd = &cobra.Command{
	Use:   "close <localPort>",
	Short: "close the tunnel",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		localPort, err := strconv.ParseUint(args[0], 10, 16)
		if err != nil {
			log.WithError(err).Fatal("invalid local port")
			return
		}

		client := api.NewPortServiceClient(dialSupervisor())

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, err = client.CloseTunnel(ctx, &api.CloseTunnelRequest{
			Port: uint32(localPort),
		})
		if err != nil {
			log.WithError(err).Fatal("cannot close the tunnel")
		}
	},
}

var autoTunnelCmd = &cobra.Command{
	Use:   "auto <enablement>",
	Short: "controls auto tunneling",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		enablement, err := strconv.ParseBool(args[0])
		if err != nil {
			log.WithError(err).Fatal("invalid enablement")
			return
		}

		client := api.NewPortServiceClient(dialSupervisor())

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, err = client.AutoTunnel(ctx, &api.AutoTunnelRequest{
			Enabled: enablement,
		})
		if err != nil {
			log.WithError(err).Fatal("cannot to update auto tunnelling enablement")
		}
	},
}

func init() {
	rootCmd.AddCommand(tunnelCmd)
	tunnelCmd.AddCommand(closeTunnelCmd)
	tunnelCmd.AddCommand(autoTunnelCmd)
}
