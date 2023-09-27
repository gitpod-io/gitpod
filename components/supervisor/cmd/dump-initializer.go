// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/executor"
	"github.com/spf13/cobra"
)

var dumpInitializer = &cobra.Command{
	Use:    "dump-init",
	Hidden: true, // this is not official user-facing functionality, but just for debugging
	Run: func(cmd *cobra.Command, args []string) {
		fc, _ := executor.Prepare(&csapi.WorkspaceInitializer{
			Spec: &csapi.WorkspaceInitializer_Git{
				Git: &csapi.GitInitializer{
					RemoteUri:        "https://github.com/gitpod-io/gitpod",
					CheckoutLocation: "gitpod",
					TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
					CloneTaget:       "main",
					Config: &csapi.GitConfig{
						Authentication: csapi.GitAuthMethod_NO_AUTH,
					},
				},
			},
		}, nil)
		fmt.Println(string(fc))
	},
}

func init() {
	rootCmd.AddCommand(dumpInitializer)
}
