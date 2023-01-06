// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"io"
	"strconv"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// innerLoopCmd represents the env command
var innerLoopCmd = &cobra.Command{
	Use:   "inner-loop",
	Short: "",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		log.SetOutput(io.Discard)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			fail(err.Error())
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:restartRing1",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			fail(err.Error())
		}
		restartType, err := strconv.Atoi(args[0])
		if err != nil {
			fail(err.Error())
		}
		err = client.RestartRing1(ctx, wsInfo.WorkspaceId, float64(restartType))
		if err != nil {
			fail(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(innerLoopCmd)
}
