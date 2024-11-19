// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/spf13/cobra"
)

var idpGCloudTokenOpts struct {
	Audience []string
}

var idpGCloudTokenCmd = &cobra.Command{
	Use:   "gcloud-token",
	Short: "Requests a gcloud format ID token for this workspace",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		cmd.SilenceUsage = true
		if len(idpGCloudTokenOpts.Audience) == 0 {
			return fmt.Errorf("missing --audience or GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE env var")
		}
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		defer func() {
			if err != nil {
				out, _ := json.Marshal(map[string]any{
					"version": 1,
					"success": false,
					"code":    "401",
					"message": err.Error(),
				})
				fmt.Print(string(out))
			}
		}()

		tkn, err := idpToken(ctx, idpGCloudTokenOpts.Audience, "")
		if err != nil {
			return err
		}

		token, _, err := jwt.NewParser().ParseUnverified(tkn, jwt.MapClaims{})
		if err != nil {
			return err
		}

		expirationDate, err := token.Claims.GetExpirationTime()
		if err != nil {
			return err
		}
		out, err := json.Marshal(map[string]any{
			"version":         1,
			"success":         true,
			"token_type":      "urn:ietf:params:oauth:token-type:id_token",
			"id_token":        tkn,
			"expiration_time": expirationDate.Unix(),
		})
		if err != nil {
			return err
		}
		fmt.Print(string(out))
		if output := os.Getenv("GOOGLE_EXTERNAL_ACCOUNT_OUTPUT_FILE"); output != "" {
			err := os.MkdirAll(path.Dir(output), 0600)
			if err != nil {
				// omit error
				return nil
			}
			// omit error
			_ = os.WriteFile(output, out, 0600)
		}
		return nil
	},
}

func init() {
	idpCmd.AddCommand(idpGCloudTokenCmd)
	audience := []string{}
	if aud := os.Getenv("GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE"); aud != "" {
		audience = append(audience, aud)
	}
	idpGCloudTokenCmd.Flags().StringArrayVar(&idpGCloudTokenOpts.Audience, "audience", audience, "audience of the ID token")
}
