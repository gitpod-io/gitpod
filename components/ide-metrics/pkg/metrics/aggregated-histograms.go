// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package metrics

import (
	"errors"
	"sync"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/prometheus"
)

type AggregatedHistograms struct {
	Labels []string

	desc        *prometheus.Desc
	upperBounds []float64

	mu         sync.RWMutex
	histograms map[string]*aggregatedHistogram
}

func NewAggregatedHistograms(name string, help string, labels []string, upperBounds []float64) *AggregatedHistograms {
	return &AggregatedHistograms{
		desc: prometheus.NewDesc(
			name,
			help,
			labels,
			nil,
		),
		Labels:      labels,
		upperBounds: upperBounds,
		histograms:  make(map[string]*aggregatedHistogram),
	}
}

type aggregatedHistogram struct {
	count       uint64
	sum         float64
	buckets     map[float64]uint64
	labelValues []string
}

func (h *AggregatedHistograms) Describe(descs chan<- *prometheus.Desc) {
	descs <- h.desc
}

func (h *AggregatedHistograms) Collect(metrics chan<- prometheus.Metric) {
	for _, m := range h.collect() {
		metrics <- m
	}
}

func (h *AggregatedHistograms) collect() (metrics []prometheus.Metric) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, histogram := range h.histograms {
		metric, err := prometheus.NewConstHistogram(
			h.desc,
			histogram.count,
			histogram.sum,
			histogram.buckets,
			histogram.labelValues...,
		)
		if err != nil {
			log.WithError(err).Error("aggregated histogram: failed to collect")
		} else {
			metrics = append(metrics, metric)
		}
	}
	return
}

func (h *AggregatedHistograms) Add(labelValues []string, count uint64, sum float64, buckets []uint64) error {
	if len(labelValues) != len(h.Labels) {
		return errors.New("invalid labels")
	}
	if len(buckets) != len(h.upperBounds) {
		return errors.New("invalid buckets")
	}
	var key string
	for _, v := range labelValues {
		key = key + v + ":"
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	histogram := h.histograms[key]
	if histogram == nil {
		histogram = &aggregatedHistogram{
			labelValues: labelValues,
			buckets:     make(map[float64]uint64, len(h.upperBounds)),
		}
		h.histograms[key] = histogram
	}
	histogram.count = histogram.count + count
	histogram.sum = histogram.sum + sum
	for i, upperBound := range h.upperBounds {
		histogram.buckets[upperBound] = histogram.buckets[upperBound] + buckets[i]
	}
	return nil
}
