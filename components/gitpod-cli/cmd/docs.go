// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/spf13/cobra"
)

// URL of the Gitpod documentation
const DocsUrl = "https://www.gitpod.io/docs"

var docsCmd = &cobra.Command{
	Use:   "docs",
	Short: "Open Gitpod Documentation in default browser",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()
		err := openPreview("GP_EXTERNAL_BROWSER", DocsUrl)
		if err != nil {
			errorCtx := context.WithValue(ctx, ctxKeyError, err)
			cmd.SetContext(errorCtx)
		}
	},
}

func init() {
	rootCmd.AddCommand(docsCmd)
}
