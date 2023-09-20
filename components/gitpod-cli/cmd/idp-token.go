// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var idpTokenOpts struct {
	Audience []string
	Decode   bool
}

var idpTokenCmd = &cobra.Command{
	Use:   "token",
	Short: "Requests an ID token for this workspace",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		tkn, err := idpToken(ctx, idpTokenOpts.Audience)

		// If the user wants to decode the token, then do so.
		if idpTokenOpts.Decode {
			// Split the token into its three parts.
			parts := strings.Split(tkn, ".")
			if len(parts) != 3 {
				xerrors.Errorf("JWT token is not valid")
			}

			// Decode the header.
			header, err := base64.RawURLEncoding.DecodeString(parts[0])
			if err != nil {
				xerrors.Errorf("Failed to decode header: ", err)
			}

			// Decode the payload.
			payload, err := base64.RawURLEncoding.DecodeString(parts[1])
			if err != nil {
				xerrors.Errorf("Failed to decode payload: ", err)
			}

			// Unmarshal the header and payload into JSON.
			var headerJSON map[string]interface{}
			var payloadJSON map[string]interface{}

			// This function unmarshals the header and payload of a JWT.
			// The header is unmarshalled into a HeaderJSON struct, and the payload is unmarshalled into a PayloadJSON struct.
			if err := json.Unmarshal(header, &headerJSON); err != nil {
				xerrors.Errorf("Failed to unmarshal header: ", err)
			}

			if err := json.Unmarshal(payload, &payloadJSON); err != nil {
				xerrors.Errorf("Failed to unmarshal payload: ", err)
			}

			output := map[string]interface{}{
				"Header":  headerJSON,
				"Payload": payloadJSON,
			}

			// The header and payload are then marshalled into a map and printed to the screen.
			outputPretty, err := json.MarshalIndent(output, "", "  ")
			if err != nil {
				xerrors.Errorf("Failed to marshal output: ", err)
			}

			fmt.Printf("%s\n", outputPretty)
			return nil
		}

		if err != nil {
			return err
		}

		fmt.Println(tkn)
		return nil
	},
}

func idpToken(ctx context.Context, audience []string) (idToken string, err error) {
	wsInfo, err := gitpod.GetWSInfo(ctx)
	if err != nil {
		return "", err
	}
	supervisorConn, err := grpc.Dial(util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return "", xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorConn.Close()
	clientToken, err := supervisor.NewTokenServiceClient(supervisorConn).GetToken(ctx, &supervisor.GetTokenRequest{
		Host: wsInfo.GitpodApi.Host,
		Kind: "gitpod",
		Scope: []string{
			"function:getWorkspace",
		},
	})
	if err != nil {
		return "", xerrors.Errorf("failed getting token from supervisor: %w", err)
	}

	c, err := client.New(client.WithCredentials(clientToken.Token), client.WithURL("https://api."+wsInfo.GitpodApi.Host))
	if err != nil {
		return "", err
	}
	tkn, err := c.IdentityProvider.GetIDToken(ctx, &connect.Request[v1.GetIDTokenRequest]{
		Msg: &v1.GetIDTokenRequest{
			Audience:    audience,
			WorkspaceId: wsInfo.WorkspaceId,
		},
	})
	if err != nil {
		return "", err
	}
	return tkn.Msg.Token, nil
}

func init() {
	idpCmd.AddCommand(idpTokenCmd)

	idpTokenCmd.Flags().StringArrayVar(&idpTokenOpts.Audience, "audience", nil, "audience of the ID token")
	_ = idpTokenCmd.MarkFlagRequired("audience")

	idpTokenCmd.Flags().BoolVar(&idpTokenOpts.Decode, "decode", false, "decode token to JSON")
}
