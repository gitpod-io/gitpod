// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry

import (
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// NewMeasuringRegistryRoundTripper produces a round tripper that exposes registry access metrics
func NewMeasuringRegistryRoundTripper(delegate http.RoundTripper, reg prometheus.Registerer) (http.RoundTripper, error) {
	metrics, err := newMetrics(reg, false)
	if err != nil {
		return nil, err
	}
	return &measuringRegistryRoundTripper{
		delegate: delegate,
		metrics:  metrics,
	}, nil
}

type measuringRegistryRoundTripper struct {
	delegate http.RoundTripper
	metrics  *metrics
}

func (m *measuringRegistryRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	t0 := time.Now()
	resp, err := m.delegate.RoundTrip(req)
	dt := time.Since(t0)

	if strings.Contains(req.URL.Path, "/manifests/") {
		m.metrics.ManifestHist.Observe(dt.Seconds())
		if err != nil {
			m.metrics.ReqFailedCounter.WithLabelValues("manifest").Inc()
		}
	} else if strings.Contains(req.URL.Path, "/blobs/") {
		m.metrics.BlobCounter.Inc()
		if err != nil {
			m.metrics.ReqFailedCounter.WithLabelValues("blob").Inc()
		}
	}

	return resp, err
}

// Metrics combine custom metrics exported by registry facade
type metrics struct {
	ManifestHist            prometheus.Histogram
	ReqFailedCounter        *prometheus.CounterVec
	BlobCounter             prometheus.Counter
	BlobDownloadSizeCounter *prometheus.CounterVec
	BlobDownloadCounter     *prometheus.CounterVec
	BlobDownloadSpeedHist   *prometheus.HistogramVec
}

func newMetrics(reg prometheus.Registerer, upstream bool) (*metrics, error) {
	manifestHist := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "manifest_req_seconds",
		Help:    "time of manifest requests made to the downstream registry",
		Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 60, 300, 600, 1800},
	})
	err := reg.Register(manifestHist)
	if err != nil {
		return nil, err
	}

	reqFailedCounter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "req_failed_total",
			Help: "number of requests that failed",
		}, []string{"type"},
	)
	err = reg.Register(reqFailedCounter)
	if err != nil {
		return nil, err
	}

	blobCounter := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "blob_req_total",
		Help: "number of blob requests made to the downstream registry",
	})
	err = reg.Register(blobCounter)
	if err != nil {
		return nil, err
	}

	blobDownloadCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "blob_req_dl_total",
		Help: "number of blob download requests",
	}, []string{"blobSource", "ok"})
	err = reg.Register(blobDownloadCounter)
	if err != nil {
		return nil, err
	}

	blobDownloadSizeCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "blob_req_bytes_total",
		Help: "amount of blob bytes downloaded",
	}, []string{"blobSource"})
	err = reg.Register(blobDownloadSizeCounter)
	if err != nil {
		return nil, err
	}

	blobDownloadSpeedHist := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "blob_req_bytes_second",
		Help:    "blob download speed in bytes per second",
		Buckets: prometheus.ExponentialBuckets(1024*1024, 2, 15),
	}, []string{"blobSource"})
	if upstream {
		err = reg.Register(blobDownloadSpeedHist)
		if err != nil {
			return nil, err
		}
	}

	return &metrics{
		ManifestHist:            manifestHist,
		ReqFailedCounter:        reqFailedCounter,
		BlobCounter:             blobCounter,
		BlobDownloadSpeedHist:   blobDownloadSpeedHist,
		BlobDownloadSizeCounter: blobDownloadSizeCounter,
		BlobDownloadCounter:     blobDownloadCounter,
	}, nil
}
