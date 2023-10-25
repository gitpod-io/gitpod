// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/gitpod-io/local-app/config"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	authRedirectURL string
	authTimeout     time.Duration
)

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login <token>",
	Short: "Logs the user in to the CLI",
	Long:  `Logs the user in and stores the token in the system keychain.`,
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) > 0 {
			err := storeToken(args[0])
			return err
		} else {
			_, err := Login(auth.LoginOpts{GitpodURL: config.GetGitpodUrl(), RedirectURL: authRedirectURL, AuthTimeout: authTimeout})
			return err
		}
	},
}

func init() {
	rootCmd.AddCommand(loginCmd)

	loginCmd.Flags().StringVarP(&authRedirectURL, "auth-redirect-url", "r", "", "Auth redirect URL")
	loginCmd.Flags().DurationVarP(&authTimeout, "auth-timeout", "u", 30, "Auth timeout in seconds")
}

func storeToken(token string) error {
	var err error

	if token != "" {
		err = auth.SetToken(config.GetString("host"), token)
		if err != nil {
			logrus.WithField("origin", config.GetString("host")).Warnf("could not write token to keyring: %s", err)
			// Allow to continue
			err = nil
		}
	}
	return err
}

func Login(loginOpts auth.LoginOpts) (string, error) {
	tkn, err := auth.Login(context.Background(), loginOpts)
	if tkn != "" {
		err = storeToken(tkn)
	}
	return tkn, err
}
