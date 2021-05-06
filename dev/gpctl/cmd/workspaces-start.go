// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/alecthomas/repr"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/namegen"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

var startWorkspaceReq = api.StartWorkspaceRequest{
	Metadata: &api.WorkspaceMetadata{},
}

// workspacesStartCmd starts a new workspace
var workspacesStartCmd = &cobra.Command{
	Use:   "start <id> <configfile.json>",
	Short: "starts a new workspace",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		fc, err := os.ReadFile(args[1])
		if err != nil {
			log.WithError(err).Fatal("cannot read workspace spec")
		}
		var workspace api.StartWorkspaceSpec
		if err := json.Unmarshal(fc, &workspace); err != nil {
			log.WithError(err).Fatal("cannot parse workspace spec")
		}

		count, _ := cmd.Flags().GetInt("count")
		id := args[0]
		workspaceID := startWorkspaceReq.Metadata.MetaId
		setServicePrefix := startWorkspaceReq.ServicePrefix == ""
		startWorkspaceReq.Spec = &workspace

		tpe, _ := cmd.Flags().GetString("type")
		tpeidx, ok := api.WorkspaceType_value[strings.ToUpper(tpe)]
		if !ok {
			log.Fatalf("unknown workspace type: %s", tpe)
		}
		startWorkspaceReq.Type = api.WorkspaceType(tpeidx)

		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		for i := 0; i < count; i++ {
			startWorkspaceReq.Id = id
			if count > 1 {
				startWorkspaceReq.Id = fmt.Sprintf("%s%04d", id, i)
				startWorkspaceReq.Metadata.MetaId = fmt.Sprintf("%s%04d", workspaceID, i)
			}
			if setServicePrefix {
				startWorkspaceReq.ServicePrefix = startWorkspaceReq.Id
			}

			resp, err := client.StartWorkspace(ctx, &startWorkspaceReq)
			if err != nil {
				log.WithError(err).Fatal("error during RPC call")
			}
			if count <= 1 {
				repr.Println(resp)
				continue
			}

			log.WithField("id", startWorkspaceReq.Id).WithField("url", resp.Url).Info("workspace started")
		}

	},
}

func init() {
	wsid, err := namegen.GenerateWorkspaceID()
	if err != nil {
		log.WithError(err).Fatal("cannot generate workspace id")
		return
	}

	workspacesCmd.AddCommand(workspacesStartCmd)
	workspacesStartCmd.Flags().StringVar(&startWorkspaceReq.ServicePrefix, "service-prefix", "", "use a service prefix different from the workspace ID")
	workspacesStartCmd.Flags().StringVar(&startWorkspaceReq.Metadata.Owner, "owner", "gpctl", "set the workspace owner")
	workspacesStartCmd.Flags().StringVar(&startWorkspaceReq.Metadata.MetaId, "workspace-id", wsid, "set the workspace ID")
	workspacesStartCmd.Flags().IntP("count", "n", 1, "start multiple workspaces with the same spec - useful for load tests")

	var types []string
	for k := range api.WorkspaceType_value {
		types = append(types, strings.ToLower(k))
	}
	workspacesStartCmd.Flags().String("type", "regular", fmt.Sprintf("type of the workspace - valid values are: %s", strings.Join(types, ", ")))
}
