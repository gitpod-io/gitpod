// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

// urlCmd represents the url command
var urlCmd = &cobra.Command{
	Use:   "url [port]",
	Short: "Prints the URL of this workspace",
	Long: `Prints the URL of this workspace. This command can print the URL of
the current workspace itself, or of a service running in this workspace on a
particular port. For example:
    gp url 8080
will print the URL of a service/server exposed on port 8080.`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			fmt.Println(os.Getenv("GITPOD_WORKSPACE_URL"))
			return nil
		}

		port, err := strconv.ParseUint(args[0], 10, 16)
		if err != nil {
			return GpError{Err: xerrors.Errorf("port \"%s\" is not a valid number", args[0]), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		fmt.Println(GetWorkspaceURL(int(port)))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(urlCmd)
}

func GetWorkspaceURL(port int) (url string) {
	wsurl := os.Getenv("GITPOD_WORKSPACE_URL")
	if port == 0 {
		return wsurl
	}

	serviceurl := wsurl
	serviceurl = strings.Replace(serviceurl, "https://", fmt.Sprintf("https://%d-", port), -1)
	serviceurl = strings.Replace(serviceurl, "http://", fmt.Sprintf("http://%d-", port), -1)
	return serviceurl
}
