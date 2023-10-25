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
	mockKeyring     bool
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
			_, err := Login(auth.LoginOpts{GitpodURL: config.GetString("host"), RedirectURL: authRedirectURL, AuthTimeout: authTimeout}, &args[0])
			return err
		} else {
			_, err := Login(auth.LoginOpts{GitpodURL: config.GetString("host"), RedirectURL: authRedirectURL, AuthTimeout: authTimeout}, nil)
			return err
		}
	},
}

func init() {
	rootCmd.AddCommand(loginCmd)

	loginCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
	runCmd.Flags().StringVarP(&authRedirectURL, "auth-redirect-url", "r", "", "Auth redirect URL")
	runCmd.Flags().BoolVarP(&mockKeyring, "mock-keyring", "m", false, "Don't use system native keyring, but store Gitpod token in memory")
	runCmd.Flags().DurationVarP(&authTimeout, "auth-timeout", "u", 30, "Auth timeout in seconds")
}

func Login(loginOpts auth.LoginOpts, userProvidedToken *string) (string, error) {
	var err error
	tkn := userProvidedToken
	if userProvidedToken == nil {
		tempTkn, err := auth.Login(context.Background(), loginOpts)
		if err != nil {
			return "", err
		}
		tkn = &tempTkn
	}

	if *tkn != "" {
		err = auth.SetToken(loginOpts.GitpodURL, *tkn)
		if err != nil {
			logrus.WithField("origin", loginOpts.GitpodURL).Warnf("could not write token to keyring: %s", err)
			err = nil
		}
	}
	return *tkn, err
}
