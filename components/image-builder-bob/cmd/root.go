// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"time"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "bob",
	Short: "Bob is the in-workspace component of the image builder. You should never have to interact with it directly.",
}

// Execute runs the root command
func Execute() {
	log.Init("bob", "", true, false)
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)

		if log.Log.Logger.IsLevelEnabled(logrus.DebugLevel) {
			time.Sleep(1 * time.Minute)
		}

		os.Exit(1)
	}
}

func init() {
}
