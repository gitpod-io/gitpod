// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	api "github.com/gitpod-io/gitpod/gitpod-protocol"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var usersCmd = &cobra.Command{
	Use:   "users",
	Short: "Interact with Public API services",
}

var usersCmdOpts struct {
	address  string
	insecure bool
	token    string
}

func init() {
	rootCmd.AddCommand(usersCmd)

	usersCmd.PersistentFlags().StringVar(&usersCmdOpts.address, "address", "wss://gitpod.io/api/v1", "Address of the API endpoint. Must be in the form <host>:<port>.")
	usersCmd.PersistentFlags().BoolVar(&usersCmdOpts.insecure, "insecure", false, "Disable TLS when making requests against the API. For testing purposes only.")
	usersCmd.PersistentFlags().StringVar(&usersCmdOpts.token, "token", os.Getenv("GPCTL_API_TOKEN"), "Authentication token to interact with the API")
}

func newLegacyAPIConn() (*api.APIoverJSONRPC, error) {
	if usersCmdOpts.address == "" {
		return nil, fmt.Errorf("empty connection address")
	}

	if usersCmdOpts.token == "" {
		return nil, fmt.Errorf("empty connection token. Use --token or GPCTL_API_TOKEN to provide one.")
	}

	conn, err := api.ConnectToServer(usersCmdOpts.address, api.ConnectToServerOpts{
		Token: usersCmdOpts.token,
		Log:   logrus.NewEntry(log.Log.Logger),
		ExtraHeaders: map[string]string{
			"User-Agent":       "gitpod/gpctl",
			"X-Client-Version": "0",
		},
	})
	if err != nil {
		return nil, fmt.Errorf("cannot connect to server at %s: %w", usersCmdOpts.address, err)
	}

	return conn, nil
}

func blockUser(ctx context.Context, args []string, block bool) {
	client, err := newLegacyAPIConn()
	if err != nil {
		log.WithError(err).Fatal("cannot connect")
	}
	defer client.Close()

	for _, uid := range args {
		err = client.AdminBlockUser(ctx, &protocol.AdminBlockUserRequest{
			UserID:    uid,
			IsBlocked: block,
		})
		if err != nil {
			log.WithField("uid", uid).WithField("block", block).Errorf("AdminBlockUser failed with: %v", err)
			return
		} else {
			log.WithField("uid", uid).WithField("block", block).Info("AdminBlockUser")
			return
		}
	}
	log.Fatal("no args")
}
