// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
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

type operator string

const (
	operatorProjectBuild      operator = "project-build"
	operatorProjectRebuildAll operator = "project-rebuild-all"
)

func callJetBrainsBackendCLI(ctx context.Context, operator operator, params url.Values) error {
	if err := waitForPort(ctx, uint64(jetBrainsOptions.Port)); err != nil {
		return err
	}
	cliUrl := getJetBrainsBackendPluginCliApiUrl()
	if params == nil {
		params = url.Values{}
	}
	params.Add("op", string(operator))
	cliUrl.RawQuery = params.Encode()

	client := http.DefaultClient
	req, err := http.NewRequestWithContext(ctx, "GET", cliUrl.String(), nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}
	return nil
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
