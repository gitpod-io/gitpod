// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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
	metrics, err := newMetrics(reg)
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
	} else if strings.Contains(req.URL.Path, "/blobs/") {
		m.metrics.BlobCounter.Inc()
	}

	return resp, err
}

// Metrics combine custom metrics exported by registry facade
type metrics struct {
	ManifestHist prometheus.Histogram
	BlobCounter  prometheus.Counter
}

func newMetrics(reg prometheus.Registerer) (*metrics, error) {
	manifestHist := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "manifest_req_seconds",
		Help:    "time of manifest requests made to the downstream registry",
		Buckets: []float64{0.1, 0.5, 1, 2, 5, 10},
	})
	err := reg.Register(manifestHist)
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
	return &metrics{
		ManifestHist: manifestHist,
		BlobCounter:  blobCounter,
	}, nil
}
