// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// +build linux

package cmd

import (
	"os"
	"syscall"

	"github.com/gitpod-io/installer/pkg/sources"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// bashCmd represents the gcp command
var bashCmd = &cobra.Command{
	Use:   "bash",
	Short: "Starts bash after putting all the scripts in place",
	Run: func(cmd *cobra.Command, args []string) {
		log.Info("Copying installation scripts")
		layout := getLayout()
		err := sources.CloneAndOwn(layout, getCloneAndOwnOpts())
		if err != nil {
			log.WithError(err).Fatal("cannot prepare the installation scripts")
		}

		log.Info("Starting bash")
		os.Chdir(layout.DestinationFolder())
		log.Fatal(syscall.Exec("/bin/bash", nil, os.Environ()))
	},
}

func init() {
	rootCmd.AddCommand(bashCmd)
}
