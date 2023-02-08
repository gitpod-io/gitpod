// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

// portsVisibilityCmd change visibility of port
var portsVisibilityCmd = &cobra.Command{
	Use:   "visibility <port:{private|public}>",
	Short: "Make a port public or private",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: we can add visibility for analysis later.
		portVisibility := args[0]
		s := strings.Split(portVisibility, ":")
		if len(s) != 2 {
			return GpError{Err: xerrors.Errorf("cannot parse args, should be something like `3000:public` or `3000:private`"), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}
		port, err := strconv.Atoi(s[0])
		if err != nil {
			return GpError{Err: xerrors.Errorf("port should be integer"), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}
		visibility := s[1]
		if visibility != serverapi.PortVisibilityPublic && visibility != serverapi.PortVisibilityPrivate {
			return GpError{Err: xerrors.Errorf("visibility should be `%s` or `%s`", serverapi.PortVisibilityPublic, serverapi.PortVisibilityPrivate), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			return xerrors.Errorf("cannot get workspace info, %w", err)
		}
		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{
			"function:openPort",
			"resource:workspace::" + wsInfo.WorkspaceId + "::get/update",
		})
		if err != nil {
			return xerrors.Errorf("cannot connect to server, %w", err)
		}
		defer client.Close()
		if _, err := client.OpenPort(ctx, wsInfo.WorkspaceId, &serverapi.WorkspaceInstancePort{
			Port:       float64(port),
			Visibility: visibility,
		}); err != nil {
			return xerrors.Errorf("failed to change port visibility: %w", err)
		}
		fmt.Printf("port %v is now %s\n", port, visibility)
		return nil
	},
}

func init() {
	portsCmd.AddCommand(portsVisibilityCmd)
}
