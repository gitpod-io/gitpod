// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"net/url"
	"strconv"

	"github.com/spf13/cobra"
)

var jetBrainsCmd = &cobra.Command{
	Use:     "jetbrains",
	Aliases: []string{"jb"},
	Short:   "Interact with Gitpod's OIDC identity provider",
}
var defaultJetBrainsBackendPluginPort = 63342

var jetBrainsOptions struct {
	Port int
}

func getJetBrainsBackendPluginCliApiUrl() *url.URL {
	parsedUrl, urlParseError := url.Parse("http://localhost:" + strconv.Itoa(jetBrainsOptions.Port) + "/api/gitpod/cli")
	if urlParseError != nil {
		log.Fatal(urlParseError)
	}
	return parsedUrl
}

func init() {
	rootCmd.AddCommand(jetBrainsCmd)
	jetBrainsCmd.Flags().IntVarP(&jetBrainsOptions.Port, "port", "p", defaultJetBrainsBackendPluginPort, "port of backend plugin")
}
