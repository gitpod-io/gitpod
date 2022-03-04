// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"path/filepath"

	"github.com/spf13/cobra"
)

var wait bool

var openCmd = &cobra.Command{
	Use:  "open",
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		file, err := filepath.Abs(args[0])
		if err != nil {
			log.Fatal(err)
		}

		url, err := url.Parse("http://localhost:63342/api/gitpod/cli")
		if err != nil {
			log.Fatal(err)
		}
		query := url.Query()
		query.Add("op", "open")
		query.Add("file", file)
		query.Add("wait", fmt.Sprintf("%t", wait))
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
	rootCmd.AddCommand(openCmd)
	openCmd.Flags().BoolVar(&wait, "wait", false, "")
}
