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

func newWorkspacesOwnerTokenCommand() *cobra.Command {
	var workspaceID string

	cmd := &cobra.Command{
		Use:     "ownertoken",
		Short:   "Retrieve the owner token for a given workspace ID",
		Example: "  ownertoken --id 1234",
		Run: func(cmd *cobra.Command, args []string) {
			if workspaceID == "" {
				log.Log.Fatal("no workspace id specified, use --id to set it")
			}

			conn, err := validateAndConnect(connOpts)
			if err != nil {
				log.Log.WithError(err).Fatal()
			}

			ownerToken, err := getOwnerToken(cmd.Context(), conn, workspaceID)

			log.Log.WithError(err).WithField("ownertoken", ownerToken.String()).Debugf("Owner token response")
			if err != nil {
				log.Log.WithError(err).Fatal("Failed to retrieve owner token.")
				return
			}

			if err := printProtoMsg(os.Stdout, ownerToken); err != nil {
				log.Log.WithError(err).Fatal("Failed to serialize proto message and print it.")
			}
		},
	}

	cmd.Flags().StringVar(&workspaceID, "id", "", "Workspace ID")

	return cmd
}

func getOwnerToken(ctx context.Context, conn *grpc.ClientConn, workspaceID string) (*v1.GetOwnerTokenResponse, error) {
	service := v1.NewWorkspacesServiceClient(conn)

	log.Log.Debugf("Retrieving owner token from workspace ID: %s", workspaceID)
	resp, err := service.GetOwnerToken(ctx, &v1.GetOwnerTokenRequest{WorkspaceId: workspaceID})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve workspace (ID: %s): %w", workspaceID, err)
	}

	return resp, nil
}
