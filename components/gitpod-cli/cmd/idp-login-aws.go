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
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
)

const (
	idpAudienceAWS = "sts.amazonaws.com"
)

var idpLoginAwsOpts struct {
	RoleARN         string
	CredentialsFile string
}

var idpLoginAwsCmd = &cobra.Command{
	Use:   "aws",
	Short: "Login to AWS",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true
		if idpLoginAwsOpts.RoleARN == "" {
			return fmt.Errorf("missing --role-arn or IDP_AWS_ROLE_ARN env var")
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		tkn, err := idpToken(ctx, []string{idpAudienceAWS})
		if err != nil {
			return err
		}

		awsCmd := exec.Command("aws", "sts", "assume-role-with-web-identity", "--role-arn", idpLoginAwsOpts.RoleARN, "--role-session-name", fmt.Sprintf("gitpod-%d", time.Now().Unix()), "--web-identity-token", tkn)
		out, err := awsCmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("%w: %s", err, string(out))
		}

		var result struct {
			Credentials struct {
				AccessKeyId     string
				SecretAccessKey string
				SessionToken    string
			}
		}
		err = json.Unmarshal(out, &result)
		if err != nil {
			return err
		}

		credentials := "[default]\n"
		credentials += fmt.Sprintf("aws_access_key_id=%s\n", result.Credentials.AccessKeyId)
		credentials += fmt.Sprintf("aws_secret_access_key=%s\n", result.Credentials.SecretAccessKey)
		credentials += fmt.Sprintf("aws_session_token=%s\n", result.Credentials.SessionToken)

		_ = os.MkdirAll(filepath.Dir(idpLoginAwsOpts.CredentialsFile), 0755)
		err = os.WriteFile(idpLoginAwsOpts.CredentialsFile, []byte(credentials), 0600)
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	idpLoginCmd.AddCommand(idpLoginAwsCmd)

	idpLoginAwsCmd.Flags().StringVar(&idpLoginAwsOpts.RoleARN, "role-arn", os.Getenv("IDP_AWS_ROLE_ARN"), "AWS role to assume (defaults to IDP_AWS_ROLE_ARN env var)")

	home, err := os.UserHomeDir()
	if err != nil {
		panic(err)
	}
	idpLoginAwsCmd.Flags().StringVar(&idpLoginAwsOpts.CredentialsFile, "credentials-file", filepath.Join(home, ".aws", "credentials"), "path to the AWS credentials file")
	_ = idpLoginAwsCmd.MarkFlagFilename("credentials-file")
}
