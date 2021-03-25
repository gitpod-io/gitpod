// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
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
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			fmt.Println(os.Getenv("GITPOD_WORKSPACE_URL"))
			return
		}

		port, err := strconv.Atoi(args[0])
		if err != nil {
			fmt.Fprintf(os.Stderr, "port \"%s\" is not a valid number\n", args[0])
			return
		}
		if port <= 0 || port > math.MaxUint16 {
			fmt.Fprintf(os.Stderr, "port \"%s\" is out of range\n", args[0])
			return
		}

		fmt.Println(GetWorkspaceURL(port))
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
