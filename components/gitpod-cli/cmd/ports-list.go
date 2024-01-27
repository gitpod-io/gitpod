// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"

	"github.com/olekukonko/tablewriter"
)

var listPortsCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace ports and their states.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		client, err := supervisor.New(ctx)
		if err != nil {
			return err
		}
		defer client.Close()

		ports, err := client.GetPortsList(ctx)
		if err != nil {
			return err
		}

		if len(ports) == 0 {
			fmt.Println("No ports detected.")
			return nil
		}

		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"Port", "Status", "Protocol", "URL", "Name & Description"})
		table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
		table.SetCenterSeparator("|")

		for _, port := range ports {
			status := ""
			statusColor := tablewriter.FgHiBlackColor
			accessible := port.Exposed != nil || port.Tunneled != nil

			exposedUrl := ""
			if port.Exposed != nil {
				exposedUrl = port.Exposed.Url
			}

			if !port.Served {
				status = "not served"
			} else if !accessible {
				if port.AutoExposure == api.PortAutoExposure_failed {
					status = "failed to expose"
					statusColor = tablewriter.FgRedColor
				} else {
					status = "detecting..."
					statusColor = tablewriter.FgYellowColor
				}
			} else if port.Exposed != nil {
				if port.Exposed.Visibility == api.PortVisibility_public {
					status = "open (public)"
					statusColor = tablewriter.FgHiGreenColor
				}
				if port.Exposed.Visibility == api.PortVisibility_private {
					status = "open (private)"
					statusColor = tablewriter.FgHiCyanColor
				}
			} else if port.Tunneled != nil {
				if port.Tunneled.Visibility == api.TunnelVisiblity(api.TunnelVisiblity_value["network"]) {
					status = "open on all interfaces"
					statusColor = tablewriter.FgHiGreenColor
				}
				if port.Tunneled.Visibility == api.TunnelVisiblity(api.TunnelVisiblity_value["host"]) {
					status = "open on localhost"
					statusColor = tablewriter.FgHiGreenColor
				}
			}

			nameAndDescription := port.Name
			if len(port.Description) > 0 {
				if len(nameAndDescription) > 0 {
					nameAndDescription = fmt.Sprint(nameAndDescription, ": ", port.Description)
				} else {
					nameAndDescription = port.Description
				}
			}

			colors := []tablewriter.Colors{}
			if !noColor && utils.ColorsEnabled() {
				colors = []tablewriter.Colors{{}, {statusColor}, {}, {}}
			}

			table.Rich(
				[]string{fmt.Sprint(port.LocalPort), status, port.Exposed.Protocol.String(), exposedUrl, nameAndDescription},
				colors,
			)
		}

		table.Render()
		return nil
	},
}

func init() {
	listPortsCmd.Flags().BoolVarP(&noColor, "no-color", "", false, "Disable output colorization")
	portsCmd.AddCommand(listPortsCmd)
}
