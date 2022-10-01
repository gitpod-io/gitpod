// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// initCmd represents the init command
var prebuildLogs = &cobra.Command{
	Use:   "prebuild-logs",
	Short: "Opens logs of Gitpod prebuilds",
	Long: `
Opens all logs of Gitpod prebuilds.
Number of logs depends upon the init tasks you have configured.
	`,
	Run: func(cmd *cobra.Command, args []string) {

		const prebuildFilePath = "/workspace/.gitpod/prebuild-log-*"
		err := openPrebuildLogs(prebuildFilePath)

		if err != nil {
			log.WithError(err)
			return
		}
	},
}

func init() {
	rootCmd.AddCommand(prebuildLogs)
}

func openPrebuildLogs(prebuildFilePath string) error {
	service, err := theialib.NewServiceFromEnv()
	if err != nil {
		log.WithError(err)
		return err
	}

	for {
		_, err := service.OpenFile(theialib.OpenFileRequest{Path: prebuildFilePath})
		if err != nil {
			log.WithError(err)
			fmt.Println("Prebuild logs not found.\nMake sure you have configured prebuilds.\nLearn more about Prebuilds: https://www.gitpod.io/docs/configure/projects/prebuilds")
			return nil
		}
	}

}
