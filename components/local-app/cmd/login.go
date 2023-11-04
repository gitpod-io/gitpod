// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/spf13/cobra"
)

var loginOpts struct {
	Token          string
	Host           string
	ContextName    string
	OrganizationID string
}

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Logs the user in to the CLI",
	Long:  `Logs the user in and stores the token in the system keychain.`,
	Args:  cobra.ExactArgs(0),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		host, err := url.Parse(loginOpts.Host)
		if err != nil {
			return fmt.Errorf("cannot parse host %s: %w", loginOpts.Host, err)
		}

		token := loginOpts.Token
		if token == "" {
			token = os.Getenv("GITPOD_TOKEN")
		}
		if token == "" {
			var err error
			token, err = auth.Login(context.Background(), auth.LoginOpts{
				GitpodURL:   loginOpts.Host,
				AuthTimeout: 5 * time.Minute,
			})
			if err != nil {
				return err
			}
		}

		cfg := config.FromContext(cmd.Context())
		gpctx := &config.ConnectionContext{
			Host:           &config.YamlURL{URL: host},
			OrganizationID: loginOpts.OrganizationID,
		}

		err = auth.SetToken(loginOpts.Host, token)
		if err != nil {
			slog.Warn("could not write token to keyring, storing in config file instead", "err", err)
			gpctx.Token = token
		}

		cfg.Contexts[loginOpts.ContextName] = gpctx
		cfg.ActiveContext = loginOpts.ContextName

		if loginOpts.OrganizationID == "" {
			clnt, err := getGitpodClient(config.ToContext(context.Background(), cfg))
			if err != nil {
				return fmt.Errorf("cannot conntect to Gitpod with this context: %w", err)
			}
			orgsList, err := clnt.Teams.ListTeams(cmd.Context(), connect.NewRequest(&v1.ListTeamsRequest{}))
			if err != nil {
				return fmt.Errorf("cannot list organizations: %w. Please pass an organization ID using --organization-id", err)
			}

			var orgID string
			switch len(orgsList.Msg.GetTeams()) {
			case 0:
				return fmt.Errorf("no organizations found. Please pass an organization ID using --organization-id")
			case 1:
				orgID = orgsList.Msg.GetTeams()[0].Id
			default:
				orgID = orgsList.Msg.GetTeams()[0].Id
				slog.Info("found more than one organization and choose the first one", "org", orgID)
			}
			cfg.Contexts[loginOpts.ContextName].OrganizationID = orgID
		}

		err = config.SaveConfig(cfg.Filename, cfg)
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(loginCmd)

	host := "https://gitpod.io"
	if v := os.Getenv("GITPOD_HOST"); v != "" {
		host = v
	}
	loginCmd.Flags().StringVar(&loginOpts.Host, "host", host, "The Gitpod instance to log in to (defaults to $GITPOD_HOST)")
	loginCmd.Flags().StringVar(&loginOpts.Token, "token", "", "The token to use for authentication (defaults to $GITPOD_TOKEN)")
	loginCmd.Flags().StringVarP(&loginOpts.ContextName, "context-name", "n", "default", "The name of the context to create")
	loginCmd.Flags().StringVar(&loginOpts.OrganizationID, "org", "", "The organization ID to use for the context")
}
