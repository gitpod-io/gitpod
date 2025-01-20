// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var gitCommitMessageHelperOpts struct {
	CommitMessageFile string
}

var gitCommitMessageHelper = &cobra.Command{
	Use:    "git-commit-message-helper",
	Short:  "Gitpod's Git commit message helper",
	Long:   "Automatically adds Tool information to Git commit messages",
	Args:   cobra.ExactArgs(0),
	Hidden: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return err
		}

		content, err := os.ReadFile(gitCommitMessageHelperOpts.CommitMessageFile)
		if err != nil {
			log.WithError(err).Fatal("error reading commit message file")
			return err
		}

		toolAttribution := fmt.Sprintf("Tool: gitpod/%s", wsInfo.GitpodApi.Host)

		msg := string(content)
		if strings.Contains(msg, toolAttribution) {
			return nil
		}

		newMsg := fmt.Sprintf("%s\n\n%s", msg, toolAttribution)

		err = os.WriteFile(gitCommitMessageHelperOpts.CommitMessageFile, []byte(newMsg), 0644)
		if err != nil {
			log.WithError(err).Fatal("error writing commit message file")
			return err
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(gitCommitMessageHelper)
	gitCommitMessageHelper.Flags().StringVarP(&gitCommitMessageHelperOpts.CommitMessageFile, "file", "f", "", "Path to the commit message file")
	_ = gitCommitMessageHelper.MarkFlagRequired("file")
}
