// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

var loginOpts struct {
	Token          string
	Host           string
	ContextName    string
	OrganizationID string
	NonInteractive bool
}

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Logs the user in to the CLI",
	Long:  `Logs the user in and stores the token in the system keychain.`,
	Args:  cobra.ExactArgs(0),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		if !strings.HasPrefix(loginOpts.Host, "http") {
			loginOpts.Host = "https://" + loginOpts.Host
		}
		host, err := url.Parse(loginOpts.Host)
		if err != nil {
			return fmt.Errorf("cannot parse host %s: %w", loginOpts.Host, err)
		}

		token := loginOpts.Token
		if token == "" {
			token = os.Getenv("GITPOD_TOKEN")
		}
		if token == "" {
			if loginOpts.NonInteractive {
				return fmt.Errorf("no token provided")
			} else {
				var err error
				token, err = auth.Login(context.Background(), auth.LoginOpts{
					GitpodURL:   loginOpts.Host,
					AuthTimeout: 5 * time.Minute,
					// Request CLI scopes (extended compared to the local companion app)
					ExtendScopes: true,
				})
				if err != nil {
					return err
				}
			}
		}

		cfg := config.FromContext(cmd.Context())
		gpctx := &config.ConnectionContext{
			Host:           &config.YamlURL{URL: host},
			OrganizationID: loginOpts.OrganizationID,
		}

		err = auth.SetToken(loginOpts.Host, token)
		if err != nil {
			if slog.Default().Enabled(cmd.Context(), slog.LevelDebug) {
				slog.Debug("could not write token to keyring, storing in config file instead", "err", err)
			} else {
				slog.Warn("could not write token to keyring, storing in config file instead. Use -v to see the error.")
			}
			gpctx.Token = token
		}

		contextName := loginOpts.ContextName
		if _, exists := cfg.Contexts[contextName]; exists && !cmd.Flags().Changed("context-name") {
			contextName = host.Hostname()
		}
		cfg.Contexts[contextName] = gpctx
		cfg.ActiveContext = contextName

		if loginOpts.OrganizationID == "" {
			clnt, err := getGitpodClient(config.ToContext(context.Background(), cfg))
			if err != nil {
				return fmt.Errorf("cannot connect to Gitpod with this context: %w", err)
			}
			orgsList, err := clnt.Teams.ListTeams(cmd.Context(), connect.NewRequest(&v1.ListTeamsRequest{}))
			if err != nil {
				var (
					resolutions     []string
					unauthenticated bool
				)
				if ce := new(connect.Error); errors.As(err, &ce) && ce.Code() == connect.CodeUnauthenticated {
					unauthenticated = true
					resolutions = []string{
						"pass an organization ID using --organization-id",
					}
					if loginOpts.Token != "" {
						resolutions = append(resolutions,
							"make sure the token has the right scopes",
							"use a different token",
							"login without passing a token but using the browser instead",
						)
					}
				}
				if unauthenticated {
					return prettyprint.AddResolution(fmt.Errorf("unauthenticated"), resolutions...)
				} else {
					return prettyprint.MarkExceptional(err)
				}
			}

			orgs := orgsList.Msg.GetTeams()

			resolutions := []string{
				"pass an organization ID using --organization-id",
			}

			var orgID string
			switch len(orgs) {
			case 0:
				return prettyprint.AddResolution(fmt.Errorf("no organizations found"), resolutions...)
			case 1:
				orgID = orgs[0].Id
			default:
				if loginOpts.NonInteractive {
					resolutions = append(resolutions,
						"omit --non-interactive and select an organization interactively",
					)
					return prettyprint.AddResolution(fmt.Errorf("found more than one organization"), resolutions...)
				}

				var orgNames []string
				for _, org := range orgs {
					orgNames = append(orgNames, org.Name)
				}

				prompt := promptui.Select{
					Label: "What organization would you like to use?",
					Items: orgNames,
					Templates: &promptui.SelectTemplates{
						Selected: "Selected organization {{ . }}",
					},
				}
				selectedIndex, selectedValue, err := prompt.Run()
				if selectedValue == "" {
					return fmt.Errorf("no organization selected")
				}
				if err != nil {
					return err
				}
				orgID = orgs[selectedIndex].Id
			}
			cfg.Contexts[contextName].OrganizationID = orgID
		}

		err = config.SaveConfig(cfg.Filename, cfg)
		if err != nil {
			return err
		}

		client, err := getGitpodClient(config.ToContext(cmd.Context(), cfg))
		if err != nil {
			return err
		}
		who, err := whoami(cmd.Context(), client, gpctx)
		if err != nil {
			return err
		}

		slog.Info("Login successful")
		fmt.Println()
		return WriteTabular(who, formatOpts{}, prettyprint.WriterFormatNarrow)
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
	loginCmd.Flags().BoolVar(&loginOpts.NonInteractive, "non-interactive", false, "Disable opening the browser and prompt to select an organization")
}
