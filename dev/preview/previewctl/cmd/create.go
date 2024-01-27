// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

func newCreateCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "create",
		Aliases: []string{"start"},
		Short:   "Create a new preview environment. Alias to `leeway run dev:preview`",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := create(); err != nil {
				logger.WithError(err).Fatal("Failed to create preview.")
			}

			return nil
		},
	}

	return cmd
}

func create() error {
	cmd := exec.Command("leeway", "run", "dev:preview")
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to run command: %s", cmd.String())
	}

	return nil
}
