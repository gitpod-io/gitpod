// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"

	"github.com/olekukonko/tablewriter"
)

var listPortsCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace ports and their states.",
	Run: func(*cobra.Command, []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		ports, portsListError := supervisor_helper.GetPortsList(ctx)

		if portsListError != nil {
			utils.LogError(ctx, portsListError, "Could not get the ports list.")
			return
		}

		if len(ports) == 0 {
			fmt.Println("No ports detected.")
			return
		}

		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"Port", "Status", "URL", "Name & Description"})
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
				if port.AutoExposure == supervisor.PortAutoExposure_failed {
					status = "failed to expose"
					statusColor = tablewriter.FgRedColor
				} else {
					status = "detecting..."
					statusColor = tablewriter.FgYellowColor
				}
			} else if port.Exposed != nil {
				if port.Exposed.Visibility == supervisor.PortVisibility_public {
					status = "open (public)"
					statusColor = tablewriter.FgHiGreenColor
				}
				if port.Exposed.Visibility == supervisor.PortVisibility_private {
					status = "open (private)"
					statusColor = tablewriter.FgHiCyanColor
				}
			} else if port.Tunneled != nil {
				if port.Tunneled.Visibility == supervisor.TunnelVisiblity(supervisor.TunnelVisiblity_value["network"]) {
					status = "open on all interfaces"
					statusColor = tablewriter.FgHiGreenColor
				}
				if port.Tunneled.Visibility == supervisor.TunnelVisiblity(supervisor.TunnelVisiblity_value["host"]) {
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
				[]string{fmt.Sprint(port.LocalPort), status, exposedUrl, nameAndDescription},
				colors,
			)
		}

		table.Render()
	},
}

func init() {
	listPortsCmd.Flags().BoolVarP(&noColor, "no-color", "", false, "Disable output colorization")
	portsCmd.AddCommand(listPortsCmd)
}
