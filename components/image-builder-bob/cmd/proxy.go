// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"net/http"
	"net/url"
	"os"

	"github.com/containerd/containerd/remotes/docker"
	"github.com/docker/distribution/reference"
	"github.com/spf13/cobra"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/proxy"
)

var proxyOpts struct {
	BaseRef, TargetRef string
	Auth               string
}

// proxyCmd represents the build command
var proxyCmd = &cobra.Command{
	Use:   "proxy",
	Short: "Runs an authenticating proxy",
	Run: func(cmd *cobra.Command, args []string) {
		log.Init("bob", "", true, os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true")
		log := log.WithField("command", "proxy")

		authP, err := proxy.NewAuthorizerFromEnvVar(proxyOpts.Auth)
		if err != nil {
			log.WithError(err).WithField("auth", proxyOpts.Auth).Fatal("cannot unmarshal auth")
		}

		baseref, err := reference.ParseNamed(proxyOpts.BaseRef)
		if err != nil {
			log.WithError(err).Fatal("cannot parse base ref")
		}
		var basetag string
		if r, ok := baseref.(reference.NamedTagged); ok {
			basetag = r.Tag()
		}
		targetref, err := reference.ParseNamed(proxyOpts.TargetRef)
		if err != nil {
			log.WithError(err).Fatal("cannot parse target ref")
		}
		var targettag string
		if r, ok := targetref.(reference.NamedTagged); ok {
			targettag = r.Tag()
		}

		auth := docker.NewDockerAuthorizer(docker.WithAuthCreds(authP.Authorize))
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
	},
}

func init() {
	rootCmd.AddCommand(proxyCmd)

	// These env vars start with `WORKSPACEKIT_` so that they aren't passed on to ring2
	proxyCmd.Flags().StringVar(&proxyOpts.BaseRef, "base-ref", os.Getenv("WORKSPACEKIT_BOBPROXY_BASEREF"), "ref of the base image")
	proxyCmd.Flags().StringVar(&proxyOpts.TargetRef, "target-ref", os.Getenv("WORKSPACEKIT_BOBPROXY_TARGETREF"), "ref of the target image")
	proxyCmd.Flags().StringVar(&proxyOpts.Auth, "auth", os.Getenv("WORKSPACEKIT_BOBPROXY_AUTH"), "authentication to use")
}
