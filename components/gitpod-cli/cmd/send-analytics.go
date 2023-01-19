// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/spf13/cobra"
)

type AnalyticsData struct {
	Command            []string `json:"command,omitempty"`
	Duration           int64    `json:"duration,omitempty"`
	ErrorCode          string   `json:"errorCode,omitempty"`
	ImageBuildDuration int64    `json:"imageBuildDuration,omitempty"`
	Outcome            string   `json:"outcome,omitempty"`
}

var sendAnalyticsCmdOpts struct {
	data string
}

// sendAnalyticsCmd represents the send-analytics command
var sendAnalyticsCmd = &cobra.Command{
	Use:    "send-analytics",
	Long:   "Sending anonymous statistics about the executed gp commands inside a workspace",
	Hidden: true,
	Args:   cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		if skipAnalytics || len(args) == 0 {
			return
		}

		var data AnalyticsData
		err := json.Unmarshal([]byte(sendAnalyticsCmdOpts.data), &data)

		if err != nil {
			errorCtx := context.WithValue(cmd.Context(), ctxKeyError, err)
			cmd.SetContext(errorCtx)
			return
		}

		// if !isValidCommand(data.Command) {
		// 	err := errors.New("send-analytics: disallowed command")
		// 	errorCtx := context.WithValue(cmd.Context(), ctxKeyError, err)
		// 	cmd.SetContext(errorCtx)
		// 	return
		// }

		ctx := cmd.Context()

		supervisorClient := ctx.Value(ctxKeySupervisorClient).(*supervisor.SupervisorClient)

		event := utils.NewAnalyticsEvent(ctx, supervisorClient, &utils.TrackCommandUsageParams{
			Command:   data.Command,
			Duration:  data.Duration,
			ErrorCode: data.ErrorCode,
		})

		if data.ImageBuildDuration != 0 {
			event.Set("ImageBuildDuration", data.ImageBuildDuration)
		}

		if data.Outcome != "" {
			event.Set("Outcome", data.Outcome)
		}

		// event.Send(ctx)
	},
}

func init() {
	rootCmd.AddCommand(sendAnalyticsCmd)

	sendAnalyticsCmd.Flags().StringVarP(&sendAnalyticsCmdOpts.data, "data", "", "", "JSON encoded event data")
	sendAnalyticsCmd.MarkFlagRequired("data")
}

// TODO: make it work with sub-commands
// func isValidCommand(cmdName string) bool {
// 	for _, c := range rootCmd.Commands() {
// 		if c.Name() == cmdName {
// 			return true
// 		}
// 	}
// 	return false
// }
