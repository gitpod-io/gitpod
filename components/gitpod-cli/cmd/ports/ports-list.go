// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"fmt"
	"os"
	"sort"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/olekukonko/tablewriter"
)

func ListPortsCmd(*cobra.Command, []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn := supervisor.Dial()
	client := api.NewStatusServiceClient(conn)

	ports, portsListError := supervisor.GetPortsList(ctx, client)

	if portsListError != nil {
		log.WithError(portsListError).Error("Could not get the ports list.")
		return
	}

	if len(ports) == 0 {
		fmt.Println("No ports detected.")
		return
	}

	sort.Slice(ports, func(i, j int) bool {
		return int(ports[i].LocalPort) < int(ports[j].LocalPort)
	})

	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Port", "Status", "URL", "Name & Description"})
	table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
	table.SetCenterSeparator("|")

	for _, port := range ports {
		status := "not served"
		statusColor := tablewriter.FgHiBlackColor
		if port.Exposed == nil && port.Tunneled == nil {
			if port.AutoExposure == api.PortAutoExposure_failed {
				status = "failed to expose"
				statusColor = tablewriter.FgRedColor
			} else {
				status = "detecting..."
				statusColor = tablewriter.FgYellowColor
			}
		} else if port.Served {
			status = "open (" + port.Exposed.Visibility.String() + ")"
			if port.Exposed.Visibility == api.PortVisibility_public {
				statusColor = tablewriter.FgHiGreenColor
			} else {
				statusColor = tablewriter.FgHiCyanColor
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

		table.Rich(
			[]string{fmt.Sprint(port.LocalPort), status, port.Exposed.Url, nameAndDescription},
			[]tablewriter.Colors{{}, {statusColor}, {}, {}},
		)
	}

	table.Render()
}
