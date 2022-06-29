// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/usage/pkg/server"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(run())
}

func run() *cobra.Command {
	var (
		verbose    bool
		apiKeyFile string
		schedule   time.Duration
	)

	cmd := &cobra.Command{
		Use:     "run",
		Short:   "Starts the service",
		Version: Version,
		Run: func(cmd *cobra.Command, args []string) {
			log.Init(ServiceName, Version, true, verbose)

			err := server.Start(server.Config{
				ControllerSchedule:    schedule,
				StripeCredentialsFile: apiKeyFile,
			})
			if err != nil {
				log.WithError(err).Fatal("Failed to start usage server.")
			}
		},
	}

	cmd.Flags().BoolVar(&verbose, "verbose", false, "Toggle verbose logging (debug level)")
	cmd.Flags().DurationVar(&schedule, "schedule", 1*time.Hour, "The schedule on which the reconciler should run")
	cmd.Flags().StringVar(&apiKeyFile, "stripe-secret-path", "", "Location of the Stripe credentials file on disk")

	return cmd
}
