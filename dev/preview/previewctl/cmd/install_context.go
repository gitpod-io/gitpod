// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"time"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var (
	watch   bool
	timeout time.Duration
)

func installContextCmd(logger *logrus.Logger) *cobra.Command {

	cmd := &cobra.Command{
		Use:   "install-context",
		Short: "Installs the kubectl context of a preview environment.",
		RunE: func(cmd *cobra.Command, args []string) error {
			p, err := preview.New(branch, logger)
			if err != nil {
				return err
			}

			err = p.InstallContext(watch, timeout)
			if err != nil {
				logger.WithFields(logrus.Fields{"err": err}).Fatal("Failed to install context.")
			}

			return nil
		},
	}

	cmd.Flags().BoolVar(&watch, "watch", false, "If wait is enabled, previewctl will keep trying to install the kube-context every 30 seconds.")
	cmd.Flags().DurationVarP(&timeout, "timeout", "t", 10*time.Minute, "Timeout for the watch flag.")
	return cmd
}
