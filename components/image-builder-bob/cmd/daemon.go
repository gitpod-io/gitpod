// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"os"
	"os/signal"
	"syscall"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/builder"

	"github.com/spf13/cobra"
)

// daemonCmd represents the build command
var daemonCmd = &cobra.Command{
	Use:   "daemon <socket-path>",
	Short: "Starts a buildkitd and pre-caches images",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		if os.Geteuid() != 0 {
			log.Fatal("must run as root")
		}

		skt := args[0]
		teardown, err := builder.StartBuildDaemon(skt)
		if err != nil {
			log.WithError(err).Fatal("cannot start daemon")
		}
		defer teardown()

		rawimgs := os.Getenv("BOB_CACHE_IMAGES")
		if rawimgs != "" {
			var images []string
			err = json.Unmarshal([]byte(rawimgs), &images)
			if err != nil {
				log.WithError(err).Error("cannot unmarshal BOB_CACHE_IMAGES")
			}
		}

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("👷 image-builder daemon is up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
