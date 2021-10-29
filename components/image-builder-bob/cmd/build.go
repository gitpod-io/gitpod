// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"time"

	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/builder"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

// buildCmd represents the build command
var buildCmd = &cobra.Command{
	Use:   "build",
	Short: "Runs the image build and is configured using environment variables (see pkg/builder/config.go for details)",
	Run: func(cmd *cobra.Command, args []string) {
		t0 := time.Now()
		if os.Geteuid() != 0 {
			log.Fatal("must run as root")
		}

		// give the headless listener some time to attach
		time.Sleep(1 * time.Second)

		cfg, err := builder.GetConfigFromEnv()
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
			return
		}

		b := &builder.Builder{
			Config: cfg,
		}
		err = b.Build()
		if err != nil {
			log.WithError(err).Error("build failed")

			// make sure we're running long enough to have our logs read
			if dt := time.Since(t0); dt < 5*time.Second {
				time.Sleep(10 * time.Second)
			}

			return
		}
	},
}

func init() {
	rootCmd.AddCommand(buildCmd)
}
