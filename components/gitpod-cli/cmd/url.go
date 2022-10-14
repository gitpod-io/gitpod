// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

// urlCmdOpts represents the url command options
var urlCmdOpts struct {
	Preview  bool
	External bool
}

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
	Run: func(cmd *cobra.Command, args []string) {
		workspaceURL, err := run(cmd, args)
		if err != nil {
			fmt.Fprint(os.Stderr, err.Error())
			return
		}

		if urlCmdOpts.Preview {
			fmt.Printf("Previewing on url=%s external=%v\n", workspaceURL, previewCmdOpts.External)
			previewCmd.Run(cmd, []string{workspaceURL})
			return
		}

		fmt.Println(workspaceURL)
	},
}

func init() {
	rootCmd.AddCommand(urlCmd)

	urlCmd.Flags().BoolVar(&urlCmdOpts.Preview, "preview", false, "opens a URL in the IDE's preview")
	urlCmd.Flags().BoolVar(&previewCmdOpts.External, "external", false, "open the URL in a new browser tab")
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

func run(cmd *cobra.Command, args []string) (string, error) {
	if len(args) == 0 {
		return os.Getenv("GITPOD_WORKSPACE_URL"), nil
	}

	port, err := strconv.ParseUint(args[0], 10, 16)
	if err != nil {
		return "", fmt.Errorf("port \"%s\" is not a valid number", args[0])
	}

	return GetWorkspaceURL(int(port)), nil
}
