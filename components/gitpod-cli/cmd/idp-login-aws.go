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

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/spf13/cobra"
)

const (
	idpAudienceAWS = "sts.amazonaws.com"
)

var idpLoginAwsOpts struct {
	RoleARN         string
	Profile         string
	DurationSeconds int
}

var idpLoginAwsCmd = &cobra.Command{
	Use:   "aws",
	Short: "Login to AWS",
	Long:  "Obtains credentials to access AWS. The command delegates to `aws sts assume-role-with-web-identity`, see https://docs.aws.amazon.com/cli/latest/reference/sts/assume-role-with-web-identity.html for more details.",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true
		if idpLoginAwsOpts.RoleARN == "" {
			return fmt.Errorf("missing --role-arn or IDP_AWS_ROLE_ARN env var")
		}
		if idpLoginAwsOpts.DurationSeconds <= 0 {
			return fmt.Errorf("invalid --duration-seconds: %d, must be a positive integer", idpLoginAwsOpts.DurationSeconds)
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		tkn, err := idpToken(ctx, []string{idpAudienceAWS})
		if err != nil {
			return err
		}

		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return err
		}

		awsCmd := exec.Command("aws", "sts", "assume-role-with-web-identity",
			"--role-arn", idpLoginAwsOpts.RoleARN,
			"--role-session-name", fmt.Sprintf("%s-%d", wsInfo.WorkspaceId, time.Now().Unix()),
			"--web-identity-token", tkn,
			"--duration-seconds", fmt.Sprintf("%d", idpLoginAwsOpts.DurationSeconds),
		)
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

		vars := map[string]string{
			"aws_access_key_id":     result.Credentials.AccessKeyId,
			"aws_secret_access_key": result.Credentials.SecretAccessKey,
			"aws_session_token":     result.Credentials.SessionToken,
		}
		for k, v := range vars {
			awsCmd := exec.Command("aws", "configure", "set", "--profile", idpLoginAwsOpts.Profile, k, v)
			out, err := awsCmd.CombinedOutput()
			if err != nil {
				return fmt.Errorf("%w: %s", err, string(out))
			}
		}

		return nil
	},
}

func init() {
	idpLoginCmd.AddCommand(idpLoginAwsCmd)

	idpLoginAwsCmd.Flags().StringVar(&idpLoginAwsOpts.RoleARN, "role-arn", os.Getenv("IDP_AWS_ROLE_ARN"), "AWS role to assume (defaults to IDP_AWS_ROLE_ARN env var)")
	idpLoginAwsCmd.Flags().StringVarP(&idpLoginAwsOpts.Profile, "profile", "p", "default", "AWS profile to configure")
	idpLoginAwsCmd.Flags().IntVarP(&idpLoginAwsOpts.DurationSeconds, "duration-seconds", "d", 3600, "Duration in seconds for which the credentials will be valid (defaults to 3600), upper bound is controlled by the AWS maximum session duration. See https://docs.aws.amazon.com/cli/latest/reference/sts/assume-role-with-web-identity.html")
	_ = idpLoginAwsCmd.MarkFlagFilename("profile")
}
