// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"os"
	"time"
)

var infoCmdOpts struct {
	// Json configures whether the command output is printed as JSON, to make it machine-readable.
	Json bool
}

// infoCmd represents the info command.
var infoCmd = &cobra.Command{
	Use:   "info",
	Short: "Display workspace info, such as its ID, class, etc.",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		conn, err := supervisor_helper.Dial(ctx)
		if err != nil {
			log.Fatal(err)
		}
		defer conn.Close()

		data, err := fetchInfo(ctx, conn)
		if err != nil {
			log.Fatal(err)
		}

		if infoCmdOpts.Json {
			content, _ := json.Marshal(data)
			fmt.Println(string(content))
			return
		}

		outputInfo(data)
	},
}

func fetchInfo(ctx context.Context, conn *grpc.ClientConn) (*infoData, error) {
	wsInfo, err := supervisor.NewInfoServiceClient(conn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve workspace info: %w", err)
	}

	return &infoData{
		WorkspaceId:    wsInfo.WorkspaceId,
		InstanceId:     wsInfo.InstanceId,
		WorkspaceClass: wsInfo.WorkspaceClass,
		WorkspaceUrl:   wsInfo.WorkspaceUrl,
		ClusterHost:    wsInfo.WorkspaceClusterHost,
	}, nil
}

func outputInfo(info *infoData) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetColWidth(50)
	table.SetBorder(false)
	table.SetColumnSeparator(":")
	table.Append([]string{"Workspace ID", info.WorkspaceId})
	table.Append([]string{"Instance ID", info.InstanceId})
	table.Append([]string{"Workspace class", fmt.Sprintf("%s: %s", info.WorkspaceClass.DisplayName, info.WorkspaceClass.Description)})
	table.Append([]string{"Workspace URL", info.WorkspaceUrl})
	table.Append([]string{"Cluster host", info.ClusterHost})
	table.Render()
}

type infoData struct {
	WorkspaceId    string                                           `json:"workspace_id"`
	InstanceId     string                                           `json:"instance_id"`
	WorkspaceClass *supervisor.WorkspaceInfoResponse_WorkspaceClass `json:"workspace_class"`
	WorkspaceUrl   string                                           `json:"workspace_url"`
	ClusterHost    string                                           `json:"cluster_host"`
}

func init() {
	infoCmd.Flags().BoolVarP(&infoCmdOpts.Json, "json", "j", false, "Output in JSON format")
	rootCmd.AddCommand(infoCmd)
}
