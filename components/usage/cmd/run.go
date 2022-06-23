// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/controller"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/spf13/cobra"
	"net"
	"os"
	"time"
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

			conn, err := db.Connect(db.ConnectionParams{
				User:     os.Getenv("DB_USERNAME"),
				Password: os.Getenv("DB_PASSWORD"),
				Host:     net.JoinHostPort(os.Getenv("DB_HOST"), os.Getenv("DB_PORT")),
				Database: "gitpod",
			})
			if err != nil {
				log.WithError(err).Fatal("Failed to establish database connection.")
			}

			var billingController controller.BillingController = &controller.NoOpBillingController{}

			if apiKeyFile != "" {
				c, err := stripe.Authenticate(apiKeyFile)
				if err != nil {
					log.WithError(err).Fatal("Failed to initialize stripe client.")
				}
				billingController = controller.NewStripeBillingController(c)
			}

			ctrl, err := controller.New(schedule, controller.NewUsageReconciler(conn, billingController))
			if err != nil {
				log.WithError(err).Fatal("Failed to initialize usage controller.")
			}

			err = ctrl.Start()
			if err != nil {
				log.WithError(err).Fatal("Failed to start usage controller.")
			}
			defer ctrl.Stop()

			srv, err := baseserver.New("usage")
			if err != nil {
				log.WithError(err).Fatal("Failed to initialize server.")
			}

			err = srv.ListenAndServe()
			if err != nil {
				log.WithError(err).Fatal("Failed to listen and serve.")
			}
		},
	}

	cmd.Flags().BoolVar(&verbose, "verbose", false, "Toggle verbose logging (debug level)")
	cmd.Flags().DurationVar(&schedule, "schedule", 1*time.Hour, "The schedule on which the reconciler should run")
	cmd.Flags().StringVar(&apiKeyFile, "stripe-secret-path", "", "Location of the Stripe credentials file on disk")

	return cmd
}
