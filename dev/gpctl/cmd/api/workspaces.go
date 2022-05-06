// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"io"
	"os"
)

func newWorkspacesCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "workspaces",
		Short: "Retrieve information about workspaces",
	}

	cmd.AddCommand(newWorkspacesGetCommand())

	return cmd
}

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

			if err := connOpts.Validate(); err != nil {
				log.Log.WithError(err).Fatal("Invalid connections options.")
			}

			conn, err := newConn(connOpts)
			if err != nil {
				log.Log.WithError(err).Fatal("Failed to establish gRPC connection")
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

func printProtoMsg(w io.Writer, m proto.Message) error {
	b, err := protojson.Marshal(m)
	if err != nil {
		return fmt.Errorf("failed to marshal proto object: %w", err)
	}

	if _, err := fmt.Fprint(w, string(b)); err != nil {
		return fmt.Errorf("failed to write proto object to writer: %w", err)
	}

	return nil
}
