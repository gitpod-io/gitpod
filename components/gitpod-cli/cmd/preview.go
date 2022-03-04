// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/shlex"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
)

var regexLocalhost = regexp.MustCompile(`((^(localhost|127\.0\.0\.1))|(https?://(localhost|127\.0\.0\.1)))(:[0-9]+)?`)

var previewCmdOpts struct {
	External bool
}

// previewCmd represents the preview command
var previewCmd = &cobra.Command{
	Use:   "preview <url>",
	Short: "Opens a URL in the IDE's preview",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		url := replaceLocalhostInURL(args[0])
		if previewCmdOpts.External {
			if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
				url = "https://" + url
			}
			openPreview("GP_EXTERNAL_BROWSER", url)
			return
		}
		openPreview("GP_PREVIEW_BROWSER", url)
	},
}

func openPreview(gpBrowserEnvVar string, url string) {
	pcmd := os.Getenv(gpBrowserEnvVar)
	if pcmd == "" {
		log.Fatalf("%s is not set", gpBrowserEnvVar)
		return
	}
	pargs, err := shlex.Split(pcmd)
	if err != nil {
		log.Fatalf("cannot parse %s: %v", gpBrowserEnvVar, err)
		return
	}
	if len(pargs) > 1 {
		pcmd = pargs[0]
	}
	pcmd, err = exec.LookPath(pcmd)
	if err != nil {
		log.Fatal(err)
	}

	err = unix.Exec(pcmd, append(pargs, url), os.Environ())
	if err != nil {
		log.Fatal(err)
	}
}

func replaceLocalhostInURL(url string) string {
	return regexLocalhost.ReplaceAllStringFunc(url, func(input string) string {
		hasScheme := strings.HasPrefix(input, "http://") || strings.HasPrefix(input, "https://")
		input = strings.TrimPrefix(strings.TrimPrefix(input, "http://"), "https://")

		port := 80
		segs := strings.Split(input, ":")
		if len(segs) == 2 {
			port, _ = strconv.Atoi(strings.TrimPrefix(segs[1], ":"))
		}

		result := GetWorkspaceURL(port)
		if !hasScheme {
			result = strings.TrimPrefix(strings.TrimPrefix(result, "http://"), "https://")
		}
		return result
	})
}

func init() {
	rootCmd.AddCommand(previewCmd)
	previewCmd.Flags().BoolVar(&previewCmdOpts.External, "external", false, "open the URL in a new browser tab")
}
