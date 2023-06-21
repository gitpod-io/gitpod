// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var accessToken bool

// sshCmd commands collection
var sshCmd = &cobra.Command{
	Use:   "ssh",
	Short: "Show the SSH connection command for the current workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 10*time.Second)
		defer cancel()

		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return err
		}

		host := strings.Replace(wsInfo.WorkspaceUrl, wsInfo.WorkspaceId, wsInfo.WorkspaceId+".ssh", -1)
		sshKeyHost := fmt.Sprintf(`%s@%s`, wsInfo.WorkspaceId, host)

		sshHost := sshKeyHost

		if accessToken {
			var err error

			supervisorConn, err := grpc.Dial(util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				return xerrors.Errorf("failed connecting to supervisor: %w", err)
			}
			defer supervisorConn.Close()
			clientToken, err := supervisor.NewTokenServiceClient(supervisorConn).GetToken(ctx, &supervisor.GetTokenRequest{
				Host: wsInfo.GitpodApi.Host,
				Kind: "gitpod",
				Scope: []string{
					"function:getOwnerToken",
				},
			})
			if err != nil {
				return xerrors.Errorf("failed getting token from supervisor: %w", err)
			}

			serverLog := log.NewEntry(log.StandardLogger())

			client, err := serverapi.ConnectToServer(wsInfo.GitpodApi.Endpoint, serverapi.ConnectToServerOpts{
				Token:   clientToken.Token,
				Context: ctx,
				Log:     serverLog,
			})
			if err != nil {
				return xerrors.Errorf("failed connecting to server: %w", err)
			}

			ownerToken, err := client.GetOwnerToken(ctx, wsInfo.WorkspaceId)
			if err != nil {
				fmt.Println("failed getting owner token from server: %w", err)
			}

			fmt.Println(ownerToken)

			sshHost = fmt.Sprintf(`%s#%s@%s`, wsInfo.WorkspaceId, ownerToken, host)
		}

		sshCommand := fmt.Sprintf(`ssh '%s'`, sshHost)
		fmt.Println(sshCommand)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(sshCmd)
	sshCmd.Flags().BoolVar(&accessToken, "access-token", false, "Show the SSH access token command instead")
}
