// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installation-telemetry/pkg/common"
	"github.com/gitpod-io/gitpod/installation-telemetry/pkg/server"
	"github.com/spf13/cobra"
	"gopkg.in/segmentio/analytics-go.v3"
)

var segmentIOToken string

var sendCmd = &cobra.Command{
	Use:   "send",
	Short: "Sends telemetry data",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		config, err := common.NewConfig()
		if err != nil {
			return err
		}

		data, err := server.GetInstallationAdminData(*config)
		if err != nil {
			return err
		}

		if !data.InstallationAdmin.Settings.SendTelemetry {
			log.Info("installation-telemetry is not permitted to send - exiting")
			return nil
		}

		if segmentIOToken == "" {
			return fmt.Errorf("segmentIOToken build variable not set")
		}

		versionId := os.Getenv("GITPOD_INSTALLATION_VERSION")
		if versionId == "" {
			return fmt.Errorf("GITPOD_INSTALLATION_VERSION envvar not set")
		}

		platform := os.Getenv("GITPOD_INSTALLATION_PLATFORM")
		if platform == "" {
			return fmt.Errorf("GITPOD_INSTALLATION_PLATFORM envvar not set")
		}

		client, err := analytics.NewWithConfig(segmentIOToken, analytics.Config{})
		defer func() {
			err = client.Close()
		}()

		properties := analytics.NewProperties().
			Set("version", versionId).
			Set("totalUsers", data.TotalUsers).
			Set("totalWorkspaces", data.TotalWorkspaces).
			Set("totalInstances", data.TotalInstances).
			Set("platform", platform)

		if data.InstallationAdmin.Settings.SendCustomerID {
			properties.Set("customerID", data.CustomerID)
		}

		telemetry := analytics.Track{
			UserId:     data.InstallationAdmin.ID,
			Event:      "Installation telemetry",
			Properties: properties,
		}

		client.Enqueue(telemetry)

		log.WithField("telemetry", telemetry).Info("installation-telemetry has successfully sent data - exiting")

		return err
	},
}

func init() {
	rootCmd.AddCommand(sendCmd)
}
