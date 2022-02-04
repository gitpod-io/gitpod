// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"net/http"
	"net/url"

	"github.com/spf13/cobra"
)

var previewCmd = &cobra.Command{
	Use: "preview",
	Run: func(cmd *cobra.Command, args []string) {
		url, err := url.Parse("http://localhost:63342/api/gitpod/cli")
		if err != nil {
			log.Fatal(err)
		}
		query := url.Query()
		query.Add("op", "preview")
		query.Add("url", args[0])
		url.RawQuery = query.Encode()

		resp, err := http.Get(url.String())
		if err != nil {
			log.Fatal(err)
		}
		if resp.StatusCode != http.StatusOK {
			log.Fatal(resp.Status)
		}
	},
}

func init() {
	rootCmd.AddCommand(previewCmd)
}
