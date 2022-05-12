// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"context"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
)

func newWorkspacesGetCommand() *cobra.Command {
	var workspaceID string

	cmd := &cobra.Command{
		Use:     "get",
		Short:   "Retrieve details about a workspace by ID",
		Example: "  get --id 1234",
		Run: func(cmd *cobra.Command, args []string) {
			if workspaceID == "" {
				log.Log.Fatal("no workspace id specified, use --id to set it")
			}

			conn, err := validateAndConnect(connOpts)
			if err != nil {
				log.Log.WithError(err).Fatal()
			}

			workspace, err := getWorkspace(cmd.Context(), conn, workspaceID)

			log.Log.WithError(err).WithField("workspace", workspace.String()).Debugf("Workspace response")
			if err != nil {
				log.Log.WithError(err).Fatal("Failed to retrieve workspace.")
				return
			}

			if err := printProtoMsg(os.Stdout, workspace); err != nil {
				log.Log.WithError(err).Fatal("Failed to serialize proto message and print it.")
			}
		},
	}

	cmd.Flags().StringVar(&workspaceID, "id", "", "Workspace ID")

	return cmd
}

func getWorkspace(ctx context.Context, conn *grpc.ClientConn, workspaceID string) (*v1.GetWorkspaceResponse, error) {
	service := v1.NewWorkspacesServiceClient(conn)

	log.Log.Debugf("Retrieving workspace ID: %s", workspaceID)
	resp, err := service.GetWorkspace(ctx, &v1.GetWorkspaceRequest{WorkspaceId: workspaceID})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve workspace (ID: %s): %w", workspaceID, err)
	}

	return resp, nil
}
