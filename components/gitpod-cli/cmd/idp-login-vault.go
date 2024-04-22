// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/spf13/cobra"
)

const (
	idpAudienceVault = "vault.hashicorp.com"
)

var idpLoginVaultOpts struct {
	Role     string
	Audience []string
}

var idpLoginVaultCmd = &cobra.Command{
	Use:   "vault",
	Short: "Login to HashiCorp's Vault",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		tkn, err := idpToken(ctx, idpLoginVaultOpts.Audience)
		if err != nil {
			return err
		}

		// vault write auth/jwt/login role=demo jwt=$TKN -format=json
		out, err := exec.Command("vault", "write", "-format=json", "auth/jwt/login", "role="+idpLoginVaultOpts.Role, "jwt="+tkn).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%w: %s", err, string(out))
		}

		var result struct {
			Auth struct {
				ClientToken string `json:"client_token"`
			} `json:"auth"`
		}
		err = json.Unmarshal(out, &result)
		if err != nil {
			return err
		}

		vaultCmd := exec.Command("vault", "login", result.Auth.ClientToken)
		vaultCmd.Stdout = os.Stdout
		vaultCmd.Stderr = os.Stderr
		return vaultCmd.Run()
	},
}

func init() {
	idpLoginCmd.AddCommand(idpLoginVaultCmd)

	idpLoginVaultCmd.Flags().StringArrayVar(&idpLoginVaultOpts.Audience, "audience", []string{idpAudienceVault}, "audience of the ID token")
	idpLoginVaultCmd.Flags().StringVar(&idpLoginVaultOpts.Role, "role", os.Getenv("IDP_VAULT_ROLE"), "Vault role to assume (defaults to IDP_VAULT_ROLE env var)")
}
