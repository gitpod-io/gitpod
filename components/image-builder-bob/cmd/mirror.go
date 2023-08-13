// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"net/http"
	"os"

	"github.com/spf13/cobra"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/proxy"
)

var mirrorOpts struct {
	Auth           string
	AdditionalAuth string
}

// mirrorCmd represents the build command
var mirrorCmd = &cobra.Command{
	Use:   "mirror",
	Short: "Runs an authenticating mirror",
	Run: func(cmd *cobra.Command, args []string) {
		log.Init("bob", "", true, os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true")
		log := log.WithField("command", "mirror")

		authP, err := proxy.NewAuthorizerFromDockerEnvVar(mirrorOpts.Auth)
		if err != nil {
			log.WithError(err).WithField("auth", mirrorOpts.Auth).Fatal("cannot unmarshal auth")
		}
		authA, err := proxy.NewAuthorizerFromEnvVar(mirrorOpts.AdditionalAuth)
		if err != nil {
			log.WithError(err).WithField("auth", mirrorOpts.Auth).Fatal("cannot unmarshal auth")
		}
		authP = authP.AddIfNotExists(authA)

		prx := proxy.NewRegistryMirror(authP)
		http.Handle("/", prx)
		log.Info("starting bob mirror on :5000")
		err = http.ListenAndServe(":5000", nil)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(mirrorCmd)

	// These env vars start with `WORKSPACEKIT_` so that they aren't passed on to ring2
	mirrorCmd.Flags().StringVar(&mirrorOpts.Auth, "auth", os.Getenv("WORKSPACEKIT_BOBmirror_AUTH"), "authentication to use")
	mirrorCmd.Flags().StringVar(&mirrorOpts.AdditionalAuth, "additional-auth", os.Getenv("WORKSPACEKIT_BOBmirror_ADDITIONALAUTH"), "additional authentication to use")
}
