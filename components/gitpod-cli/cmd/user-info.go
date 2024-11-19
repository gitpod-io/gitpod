// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/olekukonko/tablewriter"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisorapi "github.com/gitpod-io/gitpod/supervisor/api"
)

var userInfoCmdOpts struct {
	// Json configures whether the command output is printed as JSON, to make it machine-readable.
	Json bool

	// EmailOnly returns only the email address of the user
	EmailOnly bool
}

// infoCmd represents the info command.
var userInfoCmd = &cobra.Command{
	Use:   "user-info",
	Short: "Display user info about the workspace owner, such as its ID, email, etc.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		client, err := connectToAPI(ctx)
		if err != nil {
			return err
		}

		user, err := client.GetLoggedInUser(ctx)
		if err != nil {
			return err
		}

		// determine which email to show: prefer SSO, with random as fallback
		email := user.GetSSOEmail()
		if email == "" {
			email = user.GetRandomEmail()
		}

		data := &userInfoData{
			UserId: user.ID,
			Email:  email,
		}

		if userInfoCmdOpts.EmailOnly {
			fmt.Println(data.Email)
			return nil
		}

		if userInfoCmdOpts.Json {
			content, _ := json.Marshal(data)
			fmt.Println(string(content))
			return nil
		}
		outputUserInfo(data)
		return nil
	},
}

type userInfoData struct {
	UserId string `json:"user_id"`
	Email  string `json:"email"`
}

func outputUserInfo(info *userInfoData) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetColWidth(50)
	table.SetBorder(false)
	table.SetColumnSeparator(":")
	table.Append([]string{"User ID", info.UserId})
	table.Append([]string{"Email", info.Email})
	table.Render()
}

func connectToAPI(ctx context.Context) (*serverapi.APIoverJSONRPC, error) {
	supervisorClient, err := supervisor.New(ctx)
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorClient.Close()

	wsinfo, err := supervisorClient.Info.WorkspaceInfo(ctx, &supervisorapi.WorkspaceInfoRequest{})
	if err != nil {
		return nil, xerrors.Errorf("failed getting workspace info from supervisor: %w", err)
	}

	clientToken, err := supervisorClient.Token.GetToken(ctx, &supervisorapi.GetTokenRequest{
		Host: wsinfo.GitpodApi.Host,
		Kind: "gitpod",
		Scope: []string{
			"function:getLoggedInUser",
		},
	})
	if err != nil {
		return nil, xerrors.Errorf("failed getting token from supervisor: %w", err)
	}

	serverLog := log.NewEntry(log.StandardLogger())
	client, err := serverapi.ConnectToServer(wsinfo.GitpodApi.Endpoint, serverapi.ConnectToServerOpts{
		Token:   clientToken.Token,
		Context: ctx,
		Log:     serverLog,
	})
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to server: %w", err)
	}
	return client, nil
}

func init() {
	userInfoCmd.Flags().BoolVarP(&userInfoCmdOpts.Json, "json", "j", false, "Output in JSON format")
	userInfoCmd.Flags().BoolVar(&userInfoCmdOpts.EmailOnly, "email", false, "Only emit the email address of the user")
	rootCmd.AddCommand(userInfoCmd)
}
