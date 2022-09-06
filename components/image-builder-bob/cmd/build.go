// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/containerd/containerd/remotes/docker"
	"github.com/docker/distribution/reference"
	"github.com/spf13/cobra"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/builder"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/proxy"
)

// buildCmd represents the build command
var buildCmd = &cobra.Command{
	Use:   "build",
	Short: "Runs the image build and is configured using environment variables (see pkg/builder/config.go for details)",
	Run: func(cmd *cobra.Command, args []string) {
		log.Init("bob", "", true, true)
		log := log.WithField("command", "build")

		t0 := time.Now()
		if os.Geteuid() != 0 {
			log.Fatal("must run as root")
		}

		go func() {
			if proxyOpts.BaseRef == "" {
				return
			}

			authP, err := proxy.NewAuthorizerFromDockerEnvVar(proxyOpts.Auth)
			if err != nil {
				log.WithError(err).WithField("auth", proxyOpts.Auth).Fatal("cannot unmarshal auth")
			}
			authA, err := proxy.NewAuthorizerFromEnvVar(proxyOpts.AdditionalAuth)
			if err != nil {
				log.WithError(err).WithField("auth", proxyOpts.Auth).Fatal("cannot unmarshal auth")
			}
			authP = authP.AddIfNotExists(authA)

			baseref, err := reference.ParseNormalizedNamed(proxyOpts.BaseRef)
			if err != nil {
				log.WithError(err).Fatal("cannot parse base ref")
			}
			var basetag string
			if r, ok := baseref.(reference.NamedTagged); ok {
				basetag = r.Tag()
			}
			targetref, err := reference.ParseNormalizedNamed(proxyOpts.TargetRef)
			if err != nil {
				log.WithError(err).Fatal("cannot parse target ref")
			}
			var targettag string
			if r, ok := targetref.(reference.NamedTagged); ok {
				targettag = r.Tag()
			}

			auth := func() docker.Authorizer { return docker.NewDockerAuthorizer(docker.WithAuthCreds(authP.Authorize)) }
			prx, err := proxy.NewProxy(&url.URL{Host: "localhost:8080", Scheme: "http"}, map[string]proxy.Repo{
				"base": {
					Host: reference.Domain(baseref),
					Repo: reference.Path(baseref),
					Tag:  basetag,
					Auth: auth,
				},
				"target": {
					Host: reference.Domain(targetref),
					Repo: reference.Path(targetref),
					Tag:  targettag,
					Auth: auth,
				},
			})
			if err != nil {
				log.Fatal(err)
			}

			http.Handle("/", prx)
			log.Info("starting bob proxy on :8080")
			err = http.ListenAndServe(":8080", nil)
			if err != nil {
				log.Fatal(err)
			}
		}()

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

			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.AddCommand(buildCmd)

	buildCmd.Flags().StringVar(&proxyOpts.BaseRef, "base-ref", os.Getenv("WORKSPACEKIT_BOBPROXY_BASEREF"), "ref of the base image")
	buildCmd.Flags().StringVar(&proxyOpts.TargetRef, "target-ref", os.Getenv("WORKSPACEKIT_BOBPROXY_TARGETREF"), "ref of the target image")
	buildCmd.Flags().StringVar(&proxyOpts.Auth, "auth", os.Getenv("WORKSPACEKIT_BOBPROXY_AUTH"), "authentication to use")
	buildCmd.Flags().StringVar(&proxyOpts.AdditionalAuth, "additional-auth", os.Getenv("WORKSPACEKIT_BOBPROXY_ADDITIONALAUTH"), "additional authentication to use")
}
