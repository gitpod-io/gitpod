// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var proxyCmd = &cobra.Command{
	Use:   "proxy",
	Short: "forward request to debug workspace",
	Run: func(cmd *cobra.Command, args []string) {
		log.Fatal(http.ListenAndServe(":8080", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// read host port from header
		})))
	},
}

func init() {
	rootCmd.AddCommand(proxyCmd)
}
