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
	BaseAuth           string
	TargetAuth         string
}

// proxyCmd represents the build command
var proxyCmd = &cobra.Command{
	Use:   "proxy",
	Short: "Runs an authenticating proxy",
	Run: func(cmd *cobra.Command, args []string) {
		log.Init("bob", "", true, os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true")
		log := log.WithField("command", "proxy")

		// Base refers to the user's base image. We prefer user given auth
		// for base ref
		authBase, err := proxy.NewAuthorizerFromEnvVar(proxyOpts.BaseAuth)
		if err != nil {
			log.WithError(err).WithField("auth", proxyOpts.BaseAuth).Fatal("cannot unmarshal authBase")
		}
		// Target refers to the target registry where we want to upload the built image.
		// We prefer existing configuration for target auth
		authTarget, err := proxy.NewAuthorizerFromDockerEnvVar(proxyOpts.TargetAuth)
		if err != nil {
			log.WithError(err).WithField("auth", proxyOpts.TargetAuth).Fatal("cannot unmarshal authTarget")
		}
		// fallback: Add missing auth to authTarget from authBase
		authTarget = authTarget.AddIfNotExists(authBase)

		// Just reuse authBase as authTarget if authTarget has not been supplied
		if authBase == nil {
			authBase = authTarget
		} else {
			// fallback: Add missing auth to authBase from authTarget
			authBase = authBase.AddIfNotExists(authTarget)
		}

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

		authB := func() docker.Authorizer { return docker.NewDockerAuthorizer(docker.WithAuthCreds(authBase.Authorize)) }
		authT := func() docker.Authorizer {
			return docker.NewDockerAuthorizer(docker.WithAuthCreds(authTarget.Authorize))
		}
		prx, err := proxy.NewProxy(&url.URL{Host: "localhost:8080", Scheme: "http"}, map[string]proxy.Repo{
			"base": {
				Host: reference.Domain(baseref),
				Repo: reference.Path(baseref),
				Tag:  basetag,
				Auth: authB,
			},
			"target": {
				Host: reference.Domain(targetref),
				Repo: reference.Path(targetref),
				Tag:  targettag,
				Auth: authT,
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
	proxyCmd.Flags().StringVar(&proxyOpts.BaseAuth, "base-auth", os.Getenv("WORKSPACEKIT_BOBPROXY_AUTH"), "authentication to use for base ref")
	proxyCmd.Flags().StringVar(&proxyOpts.TargetAuth, "target-auth", os.Getenv("WORKSPACEKIT_BOBPROXY_TARGETAUTH"), "authentication to use for target ref")
}
