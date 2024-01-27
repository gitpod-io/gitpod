// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"errors"
	"log"
	"net/url"
	"os"
	"strconv"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use: "idea-cli",
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func getCliApiUrl() *url.URL {
	var backendPort = 63342
	// TODO look up under alias + qualifier, i.e. intellij or intellij-latest
	if _, fileStatError := os.Stat("/ide-desktop/bin/idea-cli-dev"); !errors.Is(fileStatError, os.ErrNotExist) {
		backendPort = backendPort + 1
	}
	parsedUrl, urlParseError := url.Parse("http://localhost:" + strconv.Itoa(backendPort) + "/api/gitpod/cli")
	if urlParseError != nil {
		log.Fatal(urlParseError)
	}
	return parsedUrl
}

func init() {}
