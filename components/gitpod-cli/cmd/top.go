// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"

	"github.com/spf13/cobra"

	"github.com/olekukonko/tablewriter"
)

func outputTable(workspaceResources *supervisor.ResourcesStatusResponse) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"CPU (millicores)", "Memory (bytes)"})
	table.SetBorders(tablewriter.Border{Left: true, Top: true, Right: true, Bottom: false})
	table.SetCenterSeparator("|")

	cpuFraction := int64((float64(workspaceResources.Cpu.Used) / float64(workspaceResources.Cpu.Limit)) * 100)
	memFraction := int64((float64(workspaceResources.Memory.Used) / float64(workspaceResources.Memory.Limit)) * 100)
	cpu := fmt.Sprintf("%dm/%dm (%d%%)", workspaceResources.Cpu.Used, workspaceResources.Cpu.Limit, cpuFraction)
	memory := fmt.Sprintf("%dMi/%dMi (%d%%)\n", workspaceResources.Memory.Used/(1024*1024), workspaceResources.Memory.Limit/(1024*1024), memFraction)

	colors := []tablewriter.Colors{}

	if !noColor && utils.ColorsEnabled() {
		cpuColor := getColor(cpuFraction)
		memoryColor := getColor(memFraction)
		colors = []tablewriter.Colors{{cpuColor}, {memoryColor}}
	}

	table.Rich([]string{cpu, memory}, colors)

	table.Render()
}

func getColor(value int64) int {
	switch {
	case value >= 85:
		return tablewriter.FgRedColor
	case value >= 65:
		return tablewriter.FgYellowColor
	default:
		return tablewriter.FgHiGreenColor
	}
}

var topCmd = &cobra.Command{
	Use:   "top",
	Short: "Display usage of workspace resources (CPU and memory)",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		workspaceResources, err := supervisor_helper.GetWorkspaceResources(ctx)
		if err != nil {
			log.Fatalf("cannot get workspace resources: %s", err)
		}

		outputTable(workspaceResources)
	},
}

func init() {
	topCmd.Flags().BoolVarP(&noColor, "no-color", "", false, "Disable output colorization")
	rootCmd.AddCommand(topCmd)
}
