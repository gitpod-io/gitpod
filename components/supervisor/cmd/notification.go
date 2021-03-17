// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
)

var notifyCmd = &cobra.Command{
	Use:   "notify <level> <message> <actions...>",
	Short: "Notifies the user of an external event",
	Args:  cobra.MinimumNArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		client := api.NewNotificationServiceClient(dialSupervisor())

		var (
			ctx, cancel = context.WithTimeout(context.Background(), 1*time.Minute)
			level       = toLevel(args[0])
			message     = args[1]
			actions     = args[2:]
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

func toLevel(arg string) api.NotifyRequest_Level {
	level, ok := api.NotifyRequest_Level_value[strings.ToUpper(arg)]
	if !ok {
		log.WithField("level", arg).Error("Invalid level. Using ERROR")
		return api.NotifyRequest_ERROR
	}
	return api.NotifyRequest_Level(level)
}

func init() {
	rootCmd.AddCommand(notifyCmd)
}
