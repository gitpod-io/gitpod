// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"errors"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/spf13/cobra"
)

var sendAnalyticsCmdOpts struct {
	data string
}

const (
	supervisorPid = 1
)

// sendAnalyticsCmd represents the send-analytics command
var sendAnalyticsCmd = &cobra.Command{
	Use:    "send-analytics",
	Long:   "Sending anonymous statistics about the gp commands executed inside a workspace",
	Hidden: true,
	Args:   cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		if os.Getppid() != supervisorPid {
			err := errors.New("send-analytics should not be executed directly")
			log.Fatal(err)
		}

		var data utils.TrackCommandUsageParams
		err := json.Unmarshal([]byte(sendAnalyticsCmdOpts.data), &data)

		if err != nil {
			log.Fatal(err)
		}

		ctx := cmd.Context()

		supervisorClient := ctx.Value(ctxKeySupervisorClient).(*supervisor.SupervisorClient)

		event := utils.NewAnalyticsEvent(ctx, supervisorClient, &data)

		if data.ImageBuildDuration != 0 {
			event.Set("ImageBuildDuration", data.ImageBuildDuration)
		}

		if data.Outcome != "" {
			event.Set("Outcome", data.Outcome)
		}

		event.Send(ctx)
	},
}

func init() {
	rootCmd.AddCommand(sendAnalyticsCmd)

	sendAnalyticsCmd.Flags().StringVarP(&sendAnalyticsCmdOpts.data, "data", "", "", "JSON encoded event data")
	sendAnalyticsCmd.MarkFlagRequired("data")
}
