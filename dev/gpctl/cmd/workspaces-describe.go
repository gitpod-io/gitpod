// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"strings"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// workspacesDescribeCmd represents the describe command
var workspacesDescribeCmd = &cobra.Command{
	Use:   "describe <instanceID | URL>",
	Short: "describes a workspace",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		instanceID := args[0]
		var status *api.WorkspaceStatus
		if strings.ContainsAny(instanceID, ".") || strings.HasPrefix(instanceID, "http://") || strings.HasPrefix(instanceID, "https://") {
			status, err = getStatusByURL(ctx, client, instanceID)
			if err != nil {
				log.Fatal(err)
			}
		} else {
			resp, err := client.DescribeWorkspace(ctx, &api.DescribeWorkspaceRequest{
				Id: instanceID,
			})
			if err != nil {
				log.WithError(err).Fatal("error during RPC call")
			}
			status = resp.Status
		}

		tpl := `Owner:	{{ .Metadata.Owner }}
Workspace:	{{ .Metadata.MetaId }}
Instance:	{{ .Id }}
Phase:	{{.Phase}}
Conditions:
{{- if not (eq .Conditions.Failed "") }}  Failed:	{{ .Conditions.Failed }}{{ end }}
{{- if not (eq .Conditions.Timeout "") }}  Timeout:	{{ .Conditions.Timeout }}{{ end }}
  PullingImages:	{{ .Conditions.PullingImages }}
  ServiceExists:	{{ .Conditions.ServiceExists }}
  Deployed:	{{ .Conditions.Deployed }}
  FinalBackupComplete:	{{ .Conditions.FinalBackupComplete }}
Spec:
  Image:	{{ .Spec.WorkspaceImage }}
  URL:	{{ .Spec.Url }}
`
		err = getOutputFormat(tpl, "{.id}").Print(status)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesDescribeCmd)
}
