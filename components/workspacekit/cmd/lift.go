// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/lift"

	"github.com/spf13/cobra"
)

var liftCmd = &cobra.Command{
	Use:                "lift <command>",
	Short:              "runs a command in ring1",
	Args:               cobra.MinimumNArgs(1),
	FParseErrWhitelist: cobra.FParseErrWhitelist{UnknownFlags: true},
	Run: func(_ *cobra.Command, args []string) {
		// The cobra provided args do not include unparsed flags which breaks
		// e.g. integration test's agent instrumentation.
		args = os.Args[2:]

		err := lift.RunCommand(lift.DefaultSocketPath, args)
		if err != nil {
			log.WithError(err).Error("cannot lift command")
		}
	},
}

func init() {
	rootCmd.AddCommand(liftCmd)
}
