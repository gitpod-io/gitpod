// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
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
		// TODO(ak) use NotificationService.NotifyActive supervisor API instead

		ctx := cmd.Context()

		client := ctx.Value(ctxKeySupervisorClient).(*supervisor.SupervisorClient)

		client.WaitForIDEReady(ctx)

		gpBrowserEnvVar := "GP_PREVIEW_BROWSER"

		url := replaceLocalhostInURL(args[0])
		if previewCmdOpts.External {
			if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
				url = "https://" + url
			}
			gpBrowserEnvVar = "GP_EXTERNAL_BROWSER"
		}

		err := openPreview(gpBrowserEnvVar, url)
		if err != nil {
			gpErr := &GpError{
				Err: err,
			}
			cmd.SetContext(context.WithValue(ctx, ctxKeyError, gpErr))
		}
	},
}

func openPreview(gpBrowserEnvVar string, url string) error {
	pcmd := os.Getenv(gpBrowserEnvVar)
	if pcmd == "" {
		err := fmt.Errorf("%s is not set", gpBrowserEnvVar)
		return err
	}
	pargs, err := shlex.Split(pcmd)
	if err != nil {
		return err
	}
	if len(pargs) > 1 {
		pcmd = pargs[0]
	}
	pcmd, err = exec.LookPath(pcmd)
	if err != nil {
		return err
	}

	err = unix.Exec(pcmd, append(pargs, url), os.Environ())
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
