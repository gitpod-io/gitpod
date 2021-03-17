// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
)

var runCmdOpts struct {
	InNamespace bool
}

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "starts the supervisor",

	Run: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, true)

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
