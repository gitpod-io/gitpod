// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// workspacesListCmd represents the describe command
var workspacesListCmd = &cobra.Command{
	Use:   "list",
	Short: "lists all workspaces",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		resp, err := client.GetWorkspaces(ctx, &api.GetWorkspacesRequest{})
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		type PrintWorkspace struct {
			Owner       string
			WorkspaceID string
			Instance    string
			Phase       string
			Type        string
			Pod         string
			Active      bool
			Node        string
		}

		var out []PrintWorkspace
		for _, w := range resp.Status {
			pod := "unknown"
			switch w.GetSpec().GetType() {
			case api.WorkspaceType_REGULAR:
				pod = fmt.Sprintf("ws-%s", w.GetId())
			case api.WorkspaceType_PREBUILD:
				pod = fmt.Sprintf("prebuild-%s", w.GetId())
			case api.WorkspaceType_IMAGEBUILD:
				pod = fmt.Sprintf("imagebuild-%s", w.GetId())
			}

			var nodeName string
			if w.Runtime != nil {
				nodeName = w.Runtime.NodeName
			}
			out = append(out, PrintWorkspace{
				Owner:       w.GetMetadata().GetOwner(),
				WorkspaceID: w.GetMetadata().GetMetaId(),
				Instance:    w.GetId(),
				Phase:       w.GetPhase().String(),
				Type:        w.GetSpec().GetType().String(),
				Pod:         pod,
				Active:      w.GetConditions().FirstUserActivity != nil,
				Node:        nodeName,
			})
		}

		tpl := `OWNER	WORKSPACE	INSTANCE	PHASE	TYPE	POD	ACTIVE	NODE
{{- range . }}
{{ .Owner }}	{{ .WorkspaceID }}	{{ .Instance }}	{{ .Phase }}	{{ .Type }}	{{ .Pod }}	{{ .Active }}	{{ .Node -}}
{{ end }}
`
		err = getOutputFormat(tpl, "{.id}").Print(out)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesListCmd)
}
