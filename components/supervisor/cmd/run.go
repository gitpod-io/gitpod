// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
	"github.com/spf13/cobra"
)

var runCmdOpts struct {
	InNamespace bool
}

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "starts the supervisor",

	Run: func(cmd *cobra.Command, args []string) {
		var opts []supervisor.RunOption
		if runCmdOpts.InNamespace {
			opts = append(opts,
				supervisor.InNamespace(),
			)
		}

		supervisor.Run(opts...)
	},
}

func init() {
	rootCmd.AddCommand(runCmd)

	runCmd.Flags().BoolVar(&runCmdOpts.InNamespace, "inns", false, "disables teardown canary.")
}
