// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
	"github.com/spf13/cobra"
)

var runCmdOpts struct {
	NoTeardownCanary bool
	NoDebug          bool
}

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "starts the supervisor",

	Run: func(cmd *cobra.Command, args []string) {
		var opts []supervisor.RunOption
		if runCmdOpts.NoTeardownCanary {
			opts = append(opts, supervisor.WithoutTeardownCanary())
		}
		if runCmdOpts.NoDebug {
			opts = append(opts, supervisor.WithoutDebug())
		}

		supervisor.Run(opts...)
	},
}

func init() {
	rootCmd.AddCommand(runCmd)

	runCmd.Flags().BoolVar(&runCmdOpts.NoTeardownCanary, "without-teardown-canary", false, "disables the teardown canary")
	runCmd.Flags().BoolVar(&runCmdOpts.NoDebug, "without-debug", false, "disables the supervisor debug functionality")
}
