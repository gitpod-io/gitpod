// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/google/shlex"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
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
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO(ak) use NotificationService.NotifyActive supervisor API instead

		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()
		client, err := supervisor.New(ctx)
		if err != nil {
			return err
		}
		defer client.Close()

		client.WaitForIDEReady(ctx)

		gpBrowserEnvVar := "GP_PREVIEW_BROWSER"

		url := replaceLocalhostInURL(args[0])
		if previewCmdOpts.External {
			if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
				url = "https://" + url
			}
			gpBrowserEnvVar = "GP_EXTERNAL_BROWSER"
		}

		return openPreview(gpBrowserEnvVar, url)
	},
}

func openPreview(gpBrowserEnvVar string, url string) error {
	pcmd := os.Getenv(gpBrowserEnvVar)
	if pcmd == "" {
		return xerrors.Errorf("%s is not set", gpBrowserEnvVar)
	}
	pargs, err := shlex.Split(pcmd)
	if err != nil {
		return xerrors.Errorf("cannot parse %s: %w", gpBrowserEnvVar, err)
	}
	if len(pargs) > 1 {
		pcmd = pargs[0]
	}
	pcmd, err = exec.LookPath(pcmd)
	if err != nil {
		return err
	}

	var args []string
	for _, parg := range pargs[1:] {
		if parg == "" {
			continue
		}
		args = append(args, parg)
	}
	args = append(args, url)

	previewCmd := exec.Command(pcmd, args...)
	previewCmd.Stderr = os.Stderr
	err = previewCmd.Run()
	if err != nil {
		return err
	}

	return nil
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
