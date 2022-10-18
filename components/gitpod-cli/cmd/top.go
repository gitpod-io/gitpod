// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	"github.com/gitpod-io/gitpod/supervisor/api"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"

	"github.com/spf13/cobra"

	"github.com/olekukonko/tablewriter"
)

var topCmdOpts struct {
	Json bool
}

type topData struct {
	Resources      *supervisor.ResourcesStatusResponse              `json:"resources"`
	WorkspaceClass *supervisor.WorkspaceInfoResponse_WorkspaceClass `json:"workspace_class"`
}

var topCmd = &cobra.Command{
	Use:   "top",
	Short: "Display usage of workspace resources (CPU and memory)",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		conn, err := supervisor_helper.Dial(ctx)
		if err != nil {
			log.Fatal(err)
		}

		defer conn.Close()

		data := &topData{}

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			workspaceResources, err := supervisor_helper.GetWorkspaceResources(ctx, conn)
			if err != nil {
				log.Fatalf("cannot get workspace resources: %s", err)
			}
			data.Resources = workspaceResources
			wg.Done()
		}()

		go func() {
			if wsInfo, err := supervisor.NewInfoServiceClient(conn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{}); err == nil {
				data.WorkspaceClass = wsInfo.WorkspaceClass
			}
			wg.Done()
		}()

		wg.Wait()

		if topCmdOpts.Json {
			content, _ := json.Marshal(data)
			fmt.Println(string(content))
			return
		}
		outputTable(data.Resources, data.WorkspaceClass)
	},
}

func formatWorkspaceClass(workspaceClass *supervisor.WorkspaceInfoResponse_WorkspaceClass) string {
	if workspaceClass == nil || workspaceClass.DisplayName == "" {
		return ""
	}
	return fmt.Sprintf("%s: %s", workspaceClass.DisplayName, workspaceClass.Description)
}

func outputTable(workspaceResources *supervisor.ResourcesStatusResponse, workspaceClass *supervisor.WorkspaceInfoResponse_WorkspaceClass) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetBorder(false)
	table.SetColWidth(50)
	table.SetColumnSeparator(":")

	cpuFraction := int64((float64(workspaceResources.Cpu.Used) / float64(workspaceResources.Cpu.Limit)) * 100)
	memFraction := int64((float64(workspaceResources.Memory.Used) / float64(workspaceResources.Memory.Limit)) * 100)
	cpu := fmt.Sprintf("%dm/%dm (%d%%)", workspaceResources.Cpu.Used, workspaceResources.Cpu.Limit, cpuFraction)
	memory := fmt.Sprintf("%dMi/%dMi (%d%%)", workspaceResources.Memory.Used/(1024*1024), workspaceResources.Memory.Limit/(1024*1024), memFraction)

	var cpuColors, memoryColors []tablewriter.Colors
	if !noColor && utils.ColorsEnabled() {
		cpuColors = []tablewriter.Colors{nil, {getColor(workspaceResources.Cpu.Severity)}}
		memoryColors = []tablewriter.Colors{nil, {getColor(workspaceResources.Memory.Severity)}}
	}

	table.Append([]string{"Workspace class", formatWorkspaceClass(workspaceClass)})
	table.Rich([]string{"CPU (millicores)", cpu}, cpuColors)
	table.Rich([]string{"Memory (bytes)", memory}, memoryColors)

	table.Render()
}

func getColor(severity api.ResourceStatusSeverity) int {
	switch severity {
	case api.ResourceStatusSeverity_danger:
		return tablewriter.FgRedColor
	case api.ResourceStatusSeverity_warning:
		return tablewriter.FgYellowColor
	default:
		return tablewriter.FgHiGreenColor
	}
}

func init() {
	topCmd.Flags().BoolVarP(&noColor, "no-color", "", false, "Disable output colorization")
	topCmd.Flags().BoolVarP(&topCmdOpts.Json, "json", "j", false, "Output in JSON format")
	rootCmd.AddCommand(topCmd)
}
