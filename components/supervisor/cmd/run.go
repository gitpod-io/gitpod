// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
)

var runOpts struct {
	RunGP bool
}

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "starts the supervisor",

	Run: func(cmd *cobra.Command, args []string) {
		logFile := initLog(!runOpts.RunGP)
		defer logFile.Close()

		common_grpc.SetupLogging()
		supervisor.Version = Version
		supervisor.Run(supervisor.WithRunGP(runOpts.RunGP))
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
	runCmd.Flags().BoolVar(&runOpts.RunGP, "rungp", false, "run supervisor in a run-gp context")
}
