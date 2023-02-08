// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

var sendAnalyticsCmdOpts struct {
	data  string
	event string
}

// sendAnalyticsCmd represents the send-analytics command
var sendAnalyticsCmd = &cobra.Command{
	Use:    "send-analytics",
	Long:   "Sending anonymous statistics",
	Hidden: true,
	Args:   cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		file, err := os.OpenFile(os.TempDir()+"/supervisor-errors.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err == nil {
			log.SetOutput(file)
			defer file.Close()
		} else {
			log.SetLevel(log.FatalLevel)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		data := make(map[string]interface{})
		err = json.Unmarshal([]byte(sendAnalyticsCmdOpts.data), &data)
		if err != nil {
			log.Fatal(err)
		}

		conn := dialSupervisor()
		defer conn.Close()
		wsInfo, err := api.NewInfoServiceClient(conn).WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
		if err != nil {
			log.Fatal(err)
		}

		data["instanceId"] = wsInfo.InstanceId
		data["workspaceId"] = wsInfo.WorkspaceId

		w := analytics.NewFromEnvironment()
		w.Track(analytics.TrackMessage{
			Identity:   analytics.Identity{UserID: wsInfo.OwnerId},
			Event:      sendAnalyticsCmdOpts.event,
			Properties: data,
		})
		w.Close()
	},
}

func init() {
	rootCmd.AddCommand(sendAnalyticsCmd)

	sendAnalyticsCmd.Flags().StringVarP(&sendAnalyticsCmdOpts.event, "event", "", "", "event name")
	sendAnalyticsCmd.Flags().StringVarP(&sendAnalyticsCmdOpts.data, "data", "", "", "json data")

	_ = sendAnalyticsCmd.MarkFlagRequired("event")
	_ = sendAnalyticsCmd.MarkFlagRequired("data")
}
