// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log"
	"math"
	"os"
	"strconv"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
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

		service, err := theialib.NewServiceFromEnv()
		if err != nil {
			log.Fatal(err)
		}
		resp, err := service.GetPortURL(theialib.GetPortURLRequest{Port: uint16(port)})
		if err != nil {
			log.Fatal(err)
		}

		fmt.Println(resp.URL)
	},
}

func init() {
	rootCmd.AddCommand(urlCmd)
}
