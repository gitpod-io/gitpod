// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/server"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"net/url"
)

func init() {
	rootCmd.AddCommand(run())
}

func run() *cobra.Command {
	var (
		gitpodAPIURL string
		grpcPort     int
		verbose      bool
	)

	cmd := &cobra.Command{
		Use:     "run",
		Short:   "Starts the service",
		Version: Version,
		Run: func(cmd *cobra.Command, args []string) {
			log.Init(ServiceName, Version, true, verbose)
			logger := log.Log

			logger.WithField("config", flagsToLogFields(cmd.Flags())).Info("Starting with config.")

			gitpodAPI, urlErr := url.Parse(gitpodAPIURL)
			if urlErr != nil {
				logger.WithError(urlErr).Fatal("Failed to parse Gitpod API URL.")
			}

			if err := server.Start(logger, server.Config{
				GitpodAPI: gitpodAPI,
				GRPCPort:  grpcPort,
			}); err != nil {
				logger.WithError(err).Fatal("Server errored.")
			}
		},
	}

	cmd.Flags().StringVar(&gitpodAPIURL, "gitpod-api-url", "wss://main.preview.gitpod-dev.com/api/v1", "URL for existing Gitpod Websocket API")
	cmd.Flags().IntVar(&grpcPort, "grpc-port", 9001, "Port for serving gRPC traffic")
	cmd.Flags().BoolVar(&verbose, "verbose", false, "Toggle verbose logging (debug level)")

	return cmd
}

func flagsToLogFields(fs *pflag.FlagSet) logrus.Fields {
	fields := logrus.Fields{}

	fs.VisitAll(func(f *pflag.Flag) {
		fields[f.Name] = f.Value
	})

	return fields
}
