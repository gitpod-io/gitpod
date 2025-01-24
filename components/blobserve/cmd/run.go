// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
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
	blobserve_config "github.com/gitpod-io/gitpod/blobserve/pkg/config"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/blobserve/pkg/blobserve"
	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/common-go/watch"
)

var jsonLog bool
var verbose bool

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run <config.json>",
	Short: "Starts the blobserve",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := blobserve_config.GetConfig(args[0])
		if err != nil {
			log.WithError(err).WithField("filename", args[0]).Fatal("cannot load config")
		}

		var (
			dockerCfg   *configfile.ConfigFile
			dockerCfgMu sync.RWMutex
		)
		if cfg.AuthCfg != "" {
			dockerCfg = loadDockerCfg(cfg.AuthCfg)
		}

		reg := prometheus.NewRegistry()

		var (
			clientRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
				Name: "http_client_requests_total",
				Help: "Counter of outgoing HTTP requests",
			}, []string{"method", "code"})
			clientRequestsDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
				Name:    "http_client_requests_duration_seconds",
				Help:    "Histogram of outgoing HTTP request durations",
				Buckets: prometheus.DefBuckets,
			}, []string{"method", "code"})
			serverRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
				Name: "http_server_requests_total",
				Help: "Counter of incoming HTTP requests",
			}, []string{"method", "code"})
			serverRequestsDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
				Name:    "http_server_requests_duration_seconds",
				Help:    "Histogram of incoming HTTP request durations",
				Buckets: prometheus.DefBuckets,
			}, []string{"method", "code"})
		)

		resolverProvider := func() remotes.Resolver {
			var resolverOpts docker.ResolverOptions

			dockerCfgMu.RLock()
			defer dockerCfgMu.RUnlock()
			if dockerCfg != nil {
				resolverOpts.Hosts = docker.ConfigureDefaultRegistries(
					docker.WithAuthorizer(authorizerFromDockerConfig(dockerCfg)),
					docker.WithClient(&http.Client{
						Transport: promhttp.InstrumentRoundTripperCounter(clientRequestsTotal,
							promhttp.InstrumentRoundTripperDuration(clientRequestsDuration,
								http.DefaultTransport)),
					}),
				)
			}

			return docker.NewResolver(resolverOpts)
		}

		srv, err := blobserve.NewServer(cfg.BlobServe, resolverProvider,
			func(h http.Handler) http.Handler {
				return promhttp.InstrumentHandlerCounter(serverRequestsTotal,
					promhttp.InstrumentHandlerDuration(serverRequestsDuration,
						h),
				)
			},
		)
		if err != nil {
			log.WithError(err).Fatal("cannot create blob server")
		}
		go srv.MustServe()

		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}
		if cfg.PrometheusAddr != "" {
			reg.MustRegister(
				collectors.NewGoCollector(),
				collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
				clientRequestsTotal,
				clientRequestsDuration,
				serverRequestsTotal,
				serverRequestsDuration,
			)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))

			go func() {
				err := http.ListenAndServe(cfg.PrometheusAddr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
		}

		if cfg.ReadinessProbeAddr != "" {
			// use the first layer as source for the tests
			if len(cfg.BlobServe.Repos) < 1 {
				log.Fatal("To use the readiness probe you need to specify at least one blobserve repo")
			}

			var repository string
			// find first key of the blobserve repos
			for k := range cfg.BlobServe.Repos {
				repository = k
				break
			}

			named, err := reference.ParseNamed(repository)
			if err != nil {
				log.WithError(err).WithField("repo", repository).Fatal("cannot parse repository reference")
			}

			staticLayerHost := reference.Domain(named)

			// Ensure we can resolve DNS queries, and can access the registry host
			health := healthcheck.NewHandler()
			health.AddReadinessCheck("dns", kubernetes.DNSCanResolveProbe(staticLayerHost, 1*time.Second))
			health.AddReadinessCheck("registry", kubernetes.NetworkIsReachableProbe(fmt.Sprintf("https://%v", repository)))

			go func() {
				if err := http.ListenAndServe(cfg.ReadinessProbeAddr, health); err != nil && err != http.ErrServerClosed {
					log.WithError(err).Panic("error starting HTTP server")
				}
			}()
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		err = watch.File(ctx, cfg.AuthCfg, func() {
			dockerCfgMu.Lock()
			defer dockerCfgMu.Unlock()

			dockerCfg = loadDockerCfg(cfg.AuthCfg)
		})
		if err != nil {
			log.WithError(err).Fatal("cannot start watch of Docker auth configuration file")
		}

		log.Info("🏪 blobserve is up and running")
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
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
