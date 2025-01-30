// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net/http"
	"os"

	"github.com/containerd/containerd/remotes/docker"
	"github.com/spf13/cobra"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/proxy"
	"github.com/gitpod-io/gitpod/supervisor/pkg/dockerd"
)

var proxyOpts struct {
	GitpodImageAuth string
}

// dockerdProxyCmd represents the build command
var dockerdProxyCmd = &cobra.Command{
	Use:   "dockerd-proxy",
	Short: "Runs an authenticating proxy",
	Run: func(cmd *cobra.Command, args []string) {
		log.Init("dockerd-proxy", "", true, os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true")
		log := log.WithField("command", "dockerd-proxy")

		auth, err := proxy.NewAuthorizerFromGitpodImageAuth(proxyOpts.GitpodImageAuth)
		if err != nil {
			log.WithError(err).WithField("gitpodImageAuth", proxyOpts.GitpodImageAuth).Fatal("cannot unmarshal gitpodImageAuth")
		}

		//certDir := "/workspace/.dockerd-proxy/certs"
		certDir, err := os.MkdirTemp("/tmp", "gitpod-dockerd-proxy-certs")
		if err != nil {
			log.WithError(err).Fatal("cannot create temporary directory for certificates")
		}
		certPath, keyPath, err := dockerd.EnsureProxyCaAndCertificatesInstalled(certDir)
		if err != nil {
			log.WithError(err).Fatal("failed to ensure proxy CA and certificates are installed")
		}

		// Setup the (authenticating) MITM proxy to handle CONNECT requests
		authorizer := func() docker.Authorizer { return docker.NewDockerAuthorizer(docker.WithAuthCreds(auth.Authorize)) }
		mitmProxy, err := dockerd.CreateMitmProxy(certPath, keyPath, func(r *http.Request) *http.Request {
			ctx := r.Context()

			auth := authorizer()
			r = r.WithContext(context.WithValue(ctx, proxy.CONTEXT_KEY_AUTHORIZER, auth)) // install to context, as the proxy relies on it

			err = auth.Authorize(ctx, r)
			if err != nil {
				log.WithError(err).Error("cannot authorize request")
			}
			return r
		})
		if err != nil {
			log.Fatal(err)
		}

		// Setup the (authenticating) forwarding proxy to handle all other requests
		handler := func(scheme string) http.Handler {
			httpProxy, err := proxy.NewForwardProxy(authorizer, scheme)
			if err != nil {
				log.Fatal(err)
			}

			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodConnect {
					mitmProxy.ServeHTTP(w, r)
				} else {
					httpProxy.ServeHTTP(w, r)
				}
			})
		}

		log.Info("starting https dockerd proxy on :38081")
		go (func() {
			err := http.ListenAndServeTLS(":38081", certPath, keyPath, handler("https"))
			if err != nil {
				log.Fatal(err)
			}
		})()
		log.Info("starting http dockerd proxy on :38080")
		err = http.ListenAndServe(":38080", handler("http"))
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(dockerdProxyCmd)

	// These env vars start with `WORKSPACEKIT_` so that they aren't passed on to ring2
	dockerdProxyCmd.Flags().StringVar(&proxyOpts.GitpodImageAuth, "gitpod-image-auth", os.Getenv("WORKSPACEKIT_GITPOD_IMAGE_AUTH"), "docker credentials in the GITPOD_IMAGE_AUTH format")
}
