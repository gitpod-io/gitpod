// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"io"
	"os"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
)

var dropCmd = &cobra.Command{
	Use:    "drop",
	Short:  "starts a dropping rate-limiter for stdin",
	Hidden: true,
	Run: func(cmd *cobra.Command, args []string) {
		out := dropwriter.Writer(os.Stdout, dropwriter.NewBucket(128, 64))
		io.Copy(out, os.Stdin)
	},
}

func init() {
	containerCmd.AddCommand(dropCmd)
}
