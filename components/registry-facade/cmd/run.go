// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/containerd/containerd/remotes"
	"github.com/containerd/containerd/remotes/docker"
	"github.com/distribution/reference"
	"github.com/docker/cli/cli/config/configfile"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"golang.org/x/net/context"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/common-go/watch"
	"github.com/gitpod-io/gitpod/registry-facade/api/config"
	"github.com/gitpod-io/gitpod/registry-facade/pkg/registry"
)

var jsonLog bool
var verbose bool

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run <config.json>",
	Short: "Starts the registry facade",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		configPath := args[0]
		cfg, err := config.GetConfig(configPath)
		if err != nil {
			log.WithError(err).WithField("filename", configPath).Fatal("cannot load config")
		}

		promreg := prometheus.NewRegistry()
		gpreg := prometheus.WrapRegistererWithPrefix("gitpod_registry_facade_", promreg)
		rtt, err := registry.NewMeasuringRegistryRoundTripper(newDefaultTransport(), prometheus.WrapRegistererWithPrefix("downstream_", gpreg))
		if err != nil {
			log.WithError(err).Fatal("cannot register metrics")
		}
		if cfg.PrometheusAddr != "" {
			promreg.MustRegister(
				collectors.NewGoCollector(),
				collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
				common_grpc.ClientMetrics(),
			)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(promreg, promhttp.HandlerOpts{}))

			go func() {
				err := http.ListenAndServe(cfg.PrometheusAddr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
		}
		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}

		var (
			dockerCfg   *configfile.ConfigFile
			dockerCfgMu sync.RWMutex
		)
		if cfg.AuthCfg != "" {
			dockerCfg = loadDockerCfg(cfg.AuthCfg)
		}

		resolverProvider := func() remotes.Resolver {
			client := registry.NewRetryableHTTPClient()
			client.Transport = rtt

			resolverOpts := docker.ResolverOptions{
				Client: client,
			}

			dockerCfgMu.RLock()
			defer dockerCfgMu.RUnlock()
			if dockerCfg != nil {
				resolverOpts.Hosts = docker.ConfigureDefaultRegistries(
					docker.WithAuthorizer(authorizerFromDockerConfig(dockerCfg)),
					docker.WithClient(client),
				)
			}

			return docker.NewResolver(resolverOpts)
		}

		if cfg.ReadinessProbeAddr != "" {
			// use the first layer as source for the tests
			if len(cfg.Registry.StaticLayer) < 1 {
				log.Fatal("To use the readiness probe you need to specify at least one blobserve repo")
			}

			staticLayerRef := cfg.Registry.StaticLayer[0].Ref

			named, err := reference.ParseNamed(staticLayerRef)
			if err != nil {
				log.WithError(err).WithField("repo", staticLayerRef).Fatal("cannot parse repository reference")
			}

			staticLayerHost := reference.Domain(named)

			// Ensure we can resolve DNS queries, and can access the registry host
			health := healthcheck.NewHandler()
			health.AddReadinessCheck("dns", kubernetes.DNSCanResolveProbe(staticLayerHost, 1*time.Second))
			health.AddReadinessCheck("registry", kubernetes.NetworkIsReachableProbe(fmt.Sprintf("https://%v", staticLayerRef)))
			health.AddReadinessCheck("registry-facade", kubernetes.NetworkIsReachableProbe(fmt.Sprintf("https://127.0.0.1:%v/%v/base/", cfg.Registry.Port, cfg.Registry.Prefix)))

			health.AddLivenessCheck("dns", kubernetes.DNSCanResolveProbe(staticLayerHost, 1*time.Second))
			health.AddLivenessCheck("registry", kubernetes.NetworkIsReachableProbe(fmt.Sprintf("https://%v", staticLayerRef)))

			go func() {
				if err := http.ListenAndServe(cfg.ReadinessProbeAddr, health); err != nil && err != http.ErrServerClosed {
					log.WithError(err).Panic("error starting HTTP server")
				}
			}()
		}

		registryDoneChan := make(chan struct{})
		reg, err := registry.NewRegistry(cfg.Registry, resolverProvider, prometheus.WrapRegistererWithPrefix("registry_", gpreg))
		if err != nil {
			log.WithError(err).Fatal("cannot create registry")
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		err = watch.File(ctx, configPath, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()

			cfg, err := config.GetConfig(configPath)
			if err != nil {
				log.WithError(err).Warn("cannot reload configuration")
				return
			}

			err = reg.UpdateStaticLayer(ctx, cfg.Registry.StaticLayer)
			if err != nil {
				log.WithError(err).Warn("cannot reload configuration")
			}
		})
		if err != nil {
			log.WithError(err).Fatal("cannot start watch of configuration file")
		}

		err = watch.File(ctx, cfg.AuthCfg, func() {
			dockerCfgMu.Lock()
			defer dockerCfgMu.Unlock()

			dockerCfg = loadDockerCfg(cfg.AuthCfg)
		})
		if err != nil {
			log.WithError(err).Fatal("cannot start watch of Docker auth configuration file")
		}

		go func() {
			defer close(registryDoneChan)
			reg.MustServe()
		}()

		log.Info("🏪 registry facade is up and running")
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		select {
		case <-sigChan:
		case <-registryDoneChan:
		}
	},
}

func loadDockerCfg(fn string) *configfile.ConfigFile {
	if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
		fn = filepath.Join(tproot, fn)
	}
	fr, err := os.OpenFile(fn, os.O_RDONLY, 0)
	if err != nil {
		log.WithError(err).Fatal("cannot read docker auth config")
	}

	dockerCfg := configfile.New(fn)
	err = dockerCfg.LoadFromReader(fr)
	fr.Close()
	if err != nil {
		log.WithError(err).Fatal("cannot read docker config")
	}
	log.WithField("fn", fn).Info("using authentication for backing registries")

	return dockerCfg
}

func newDefaultTransport() *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: false,
		}).DialContext,
		MaxIdleConns:          0,
		MaxIdleConnsPerHost:   32,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 5 * time.Second,
		DisableKeepAlives:     true,
	}
}

func init() {
	rootCmd.AddCommand(runCmd)
}

// FromDockerConfig turns docker client config into docker registry hosts
func authorizerFromDockerConfig(cfg *configfile.ConfigFile) docker.Authorizer {
	return docker.NewDockerAuthorizer(docker.WithAuthCreds(func(host string) (user, pass string, err error) {
		auth, err := cfg.GetAuthConfig(host)
		if err != nil {
			return
		}
		user = auth.Username
		pass = auth.Password
		return
	}))
}
