// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
	"gopkg.in/segmentio/analytics-go.v3"
)

var segmentIOToken string

var sendCmd = &cobra.Command{
	Use:   "send",
	Short: "Sends telemetry data",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		// @todo(sje): replace with a database call to get status
		canSendData := false
		if !canSendData {
			log.Info("installation-telemetry is not permitted to send - exiting")
			return nil
		}

		if segmentIOToken == "" {
			return fmt.Errorf("segmentIOToken build variable not set")
		}

		domainHash := os.Getenv("GITPOD_DOMAIN_HASH")
		if domainHash == "" {
			return fmt.Errorf("GITPOD_DOMAIN_HASH envvar not set")
		}

		versionId := os.Getenv("GITPOD_INSTALLATION_VERSION")
		if versionId == "" {
			return fmt.Errorf("GITPOD_INSTALLATION_VERSION envvar not set")
		}

		client, err := analytics.NewWithConfig(segmentIOToken, analytics.Config{})
		defer func() {
			err = client.Close()
		}()

		client.Enqueue(analytics.Track{
			UserId: domainHash,
			Event:  "Installation telemetry",
			Properties: analytics.NewProperties().
				Set("version", versionId),
		})

		log.Info("installation-telemetry has successfully sent data - exiting")

		return err
	},
}

func init() {
	rootCmd.AddCommand(sendCmd)
}
