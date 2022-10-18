// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/spf13/cobra"
)

// portsVisibilityCmd change visibility of port
var portsVisibilityCmd = &cobra.Command{
	Use:   "visibility <port:{private|public}>",
	Short: "Make a port public or private",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		portVisibility := args[0]
		s := strings.Split(portVisibility, ":")
		if len(s) != 2 {
			log.Fatal("cannot parse args, should be something like `3000:public` or `3000:private`")
		}
		port, err := strconv.Atoi(s[0])
		if err != nil {
			log.Fatal("port should be integer")
		}
		visibility := s[1]
		if visibility != serverapi.PortVisibilityPublic && visibility != serverapi.PortVisibilityPrivate {
			log.Fatalf("visibility should be `%s` or `%s`", serverapi.PortVisibilityPublic, serverapi.PortVisibilityPrivate)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			log.Fatalf("cannot get workspace info, %s", err.Error())
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:openPort",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			log.Fatalf("cannot connect to server, %s", err.Error())
		}
		if _, err := client.OpenPort(ctx, wsInfo.WorkspaceId, &serverapi.WorkspaceInstancePort{
			Port:       float64(port),
			Visibility: visibility,
		}); err != nil {
			log.Fatalf("failed to change port visibility: %s", err.Error())
		}
		fmt.Printf("port %v is now %s\n", port, visibility)
	},
}

func init() {
	portsCmd.AddCommand(portsVisibilityCmd)
}
