// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"regexp"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
)

var regexLocalhost = regexp.MustCompile("((^(localhost|127\\.0\\.0\\.1))|(https?://(localhost|127\\.0\\.0\\.1)))(:[0-9]+)?")

// previewCmd represents the preview command
var previewCmd = &cobra.Command{
	Use:   "preview <url>",
	Short: "Opens a URL in Theia's preview view",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		service, err := theialib.NewServiceFromEnv()
		if err != nil {
			log.Fatal(err)
		}

		url := args[0]
		url = replaceLocalhostInURL(service, url)

		_, err = service.OpenPreview(theialib.OpenPreviewRequest{URL: url})
		if err != nil {
			log.Fatal(err)
		}
	},
}

func replaceLocalhostInURL(service theialib.TheiaCLIService, url string) string {
	return regexLocalhost.ReplaceAllStringFunc(url, func(input string) string {
		hasScheme := strings.HasPrefix(input, "http://") || strings.HasPrefix(input, "https://")
		input = strings.TrimPrefix(strings.TrimPrefix(input, "http://"), "https://")

		port := 80
		segs := strings.Split(input, ":")
		if len(segs) == 2 {
			port, _ = strconv.Atoi(strings.TrimPrefix(segs[1], ":"))
		}

		resp, err := service.GetPortURL(theialib.GetPortURLRequest{Port: uint16(port)})
		if err != nil {
			return input
		}

		result := resp.URL
		if !hasScheme {
			result = strings.TrimPrefix(strings.TrimPrefix(result, "http://"), "https://")
		}
		return result
	})
}

func init() {
	rootCmd.AddCommand(previewCmd)
}
