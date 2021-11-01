// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

var notifyCmd = &cobra.Command{
	Use:    "notify <message>",
	Short:  "Notifies the user of an external event",
	Args:   cobra.ExactArgs(1),
	Hidden: true, // this is not official user-facing functionality, but just for debugging
	Run: func(cmd *cobra.Command, args []string) {
		client := api.NewNotificationServiceClient(dialSupervisor())

		level := api.NotifyRequest_INFO
		lv, _ := cmd.Flags().GetString("level")
		if l, ok := api.NotifyRequest_Level_value[strings.ToUpper(lv)]; ok {
			level = api.NotifyRequest_Level(l)
		}

		var (
			message     = args[0]
			actions, _  = cmd.Flags().GetStringArray("actions")
			ctx, cancel = context.WithTimeout(context.Background(), 1*time.Minute)
		)
		defer cancel()

		response, err := client.Notify(ctx, &api.NotifyRequest{
			Level:   level,
			Message: message,
			Actions: actions,
		})
		if err != nil {
			log.WithError(err).Fatal("cannot notify client")
		}
		log.WithField("action", response.Action).Info("User answered")
	},
}

func init() {
	rootCmd.AddCommand(notifyCmd)

	var levels []string
	for k := range api.NotifyRequest_Level_value {
		levels = append(levels, strings.ToLower(k))
	}
	notifyCmd.Flags().String("level", "info", "notification severity - must be one of "+strings.Join(levels, ", "))
	notifyCmd.Flags().StringArray("actions", nil, "actions to offer to the user")
}
