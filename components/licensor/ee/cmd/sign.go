// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/licensor/ee/pkg/licensor"
)

// signCmd represents the sign command
var signCmd = &cobra.Command{
	Use:   "sign",
	Short: "Signs a license",
	RunE: func(cmd *cobra.Command, args []string) error {
		keyfn, _ := cmd.Flags().GetString("key")

		fc, err := os.ReadFile(keyfn)
		if err != nil {
			return err
		}
		block, _ := pem.Decode(fc)
		if block == nil {
			return xerrors.Errorf("no PEM encoded key found in %s", keyfn)
		}
		if block.Type != "PRIVATE KEY" {
			return xerrors.Errorf("unknown PEM block type %s", block.Type)
		}
		priv, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return err
		}

		var (
			domain, _   = cmd.Flags().GetString("domain")
			id, _       = cmd.Flags().GetString("id")
			level, _    = cmd.Flags().GetString("level")
			seats, _    = cmd.Flags().GetInt("seats")
			validFor, _ = cmd.Flags().GetDuration("valid-for")
		)
		if domain == "" {
			return xerrors.Errorf("--domain is mandatory")
		}
		if id == "" {
			return xerrors.Errorf("--id is mandatory")
		}
		if level == "" {
			return xerrors.Errorf("--level is mandatory")
		}
		if seats < 0 {
			return xerrors.Errorf("--seats must be positive")
		}
		if validFor <= 0 {
			return xerrors.Errorf("--valid-for must be positive")
		}

		lvl, ok := licensor.NamedLevel[level]
		if !ok {
			return xerrors.Errorf("invalid license level: %s", level)
		}

		l := licensor.LicensePayload{
			Domain:     domain,
			ID:         id,
			Seats:      seats,
			Level:      lvl,
			ValidUntil: time.Now().Add(validFor),
		}

		res, err := licensor.Sign(l, priv)
		if err != nil {
			return err
		}

		fmt.Println(string(res))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(signCmd)

	signCmd.Flags().String("domain", "", "domain for which the license is valid")
	signCmd.Flags().String("id", "", "ID of the license")
	signCmd.Flags().String("level", "enterprise", "license level, must be one of team, enterprise")
	signCmd.Flags().Int("seats", 5, "number of seats the license is valid for")
	signCmd.Flags().StringP("key", "k", "private_key.pem", "path to the private key to sign the license with")
	signCmd.Flags().Duration("valid-for", 365*24*time.Hour, "time the license is valid for")
}
