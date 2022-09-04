// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var fsPrepCmd = &cobra.Command{
	Use:   "fsprep",
	Short: "does fs prep and call supervisor",
	Run: func(_ *cobra.Command, args []string) {
		log.Info("sleeping")
		time.Sleep(6 * time.Hour)
	},
}

func init() {
	rootCmd.AddCommand(fsPrepCmd)
}
