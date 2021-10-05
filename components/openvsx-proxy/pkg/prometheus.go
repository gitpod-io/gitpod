// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package pkg

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Prometheus struct {
	reg                                 *prometheus.Registry
	BackupCacheHitCounter               prometheus.Counter
	BackupCacheMissCounter              prometheus.Counter
	BackupCacheServeCounter             prometheus.Counter
	RegularCacheHitServeCounter         prometheus.Counter
	RegularCacheMissCounter             prometheus.Counter
	RequestsCounter                     *prometheus.CounterVec
	DurationOverallHistogram            prometheus.Histogram
	DurationRequestProcessingHistogram  prometheus.Histogram
	DurationUpstreamCallHistorgram      prometheus.Histogram
	DurationResponseProcessingHistogram prometheus.Histogram
}

func (p *Prometheus) Start(cfg *Config) {
	p.reg = prometheus.NewRegistry()

	if cfg.PrometheusAddr != "" {
		p.reg.MustRegister(
			prometheus.NewGoCollector(),
			prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
		)

		handler := http.NewServeMux()
		handler.Handle("/metrics", promhttp.HandlerFor(p.reg, promhttp.HandlerOpts{}))

		go func() {
			err := http.ListenAndServe(cfg.PrometheusAddr, handler)
			if err != nil {
				log.WithError(err).Error("Prometheus metrics server failed")
			}
		}()
		log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
	}

	p.createMetrics()
	collectors := []prometheus.Collector{
		p.BackupCacheHitCounter,
		p.BackupCacheMissCounter,
		p.BackupCacheServeCounter,
		p.RegularCacheHitServeCounter,
		p.RegularCacheMissCounter,
		p.RequestsCounter,
		p.DurationOverallHistogram,
		p.DurationRequestProcessingHistogram,
		p.DurationUpstreamCallHistorgram,
		p.DurationResponseProcessingHistogram,
	}
	for _, c := range collectors {
		err := p.reg.Register(c)
		if err != nil {
			log.WithError(err).Error("register Prometheus metric failed")
		}
	}
}

func (p *Prometheus) createMetrics() {
	namespace := "gitpod"
	subsystem := "openvsx_proxy"
	p.BackupCacheHitCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "backup_cache_hit_total",
		Help:      "The total amount of requests where we had a cached response that we could use as backup when the upstream server is down.",
	})
	p.BackupCacheMissCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "backup_cache_miss_total",
		Help:      "The total amount of requests where we haven't had a cached response that we could use as backup when the upstream server is down.",
	})
	p.BackupCacheServeCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "backup_cache_serve_total",
		Help:      "The total amount of requests where we actually answered with a cached response because the upstream server is down.",
	})
	p.RegularCacheHitServeCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "regular_cache_hit_and_serve_total",
		Help:      "The total amount or requests where we answered with a cached response for performance reasons.",
	})
	p.RegularCacheMissCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "regular_cache_miss_total",
		Help:      "The total amount or requests we haven't had a young enough cached requests to use it for performance reasons.",
	})
	p.RequestsCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "requests_total",
		Help:      "The total amount of requests by response status.",
	}, []string{"status", "path"})
	p.DurationOverallHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "duration_overall_seconds",
		Help:      "The duration in seconds of the HTTP requests.",
	})
	p.DurationRequestProcessingHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "duration_request_processing_seconds",
		Help:      "The duration in seconds of the processing of the HTTP requests before we call the upstream.",
	})
	p.DurationUpstreamCallHistorgram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "duration_upstream_call_seconds",
		Help:      "The duration in seconds of the call of the upstream server.",
	})
	p.DurationResponseProcessingHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "duration_response_processing_seconds",
		Help:      "The duration in seconds of the processing of the HTTP responses after we have called the upstream.",
	})
}

func (p *Prometheus) IncStatusCounter(r *http.Request, status string) {
	path := r.URL.Path
	if strings.HasPrefix(path, "/vscode/asset/") {
		// remove everything after /vscode/asset/ to decrease the unique numbers of paths
		path = path[:len("/vscode/asset/")]
	}
	if strings.HasPrefix(path, "/vscode/gallery/itemName/") {
		// remove everything after /vscode/gallery/itemName/ to decrease the unique numbers of paths
		path = path[:len("/vscode/gallery/itemName/")]
	}
	// just to make sure that a long path doesn't slip through cut after 3 segements
	// since path starts with a / the first segment is an emtpy string, therefore len > 4 and not len > 3
	if s := strings.SplitN(path, "/", 5); len(s) > 4 {
		path = strings.Join(s[:4], "/")
	}
	p.RequestsCounter.WithLabelValues(status, fmt.Sprintf("%s %s", r.Method, path)).Inc()
}
