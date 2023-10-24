/*
Copyright © 2023 NAME HERE <EMAIL ADDRESS>
*/
package cmd

import (
	"context"
	"fmt"

	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Logs the user in to the CLI",
	Long:  `Logs the user in and stores the token in the system keychain.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("login called")
	},
}

func init() {
	rootCmd.AddCommand(loginCmd)

	loginCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}

func Login(loginOpts auth.LoginOpts) (string, error) {
	tkn, err := auth.Login(context.Background(), loginOpts)
	if tkn != "" {
		err = auth.SetToken(loginOpts.GitpodURL, tkn)
		if err != nil {
			logrus.WithField("origin", loginOpts.GitpodURL).Warnf("could not write token to keyring: %s", err)
			// Allow to continue
			err = nil
		}
	}
	return tkn, err
}
