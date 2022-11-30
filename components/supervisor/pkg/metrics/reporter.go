// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	api "github.com/gitpod-io/gitpod/ide-metrics-api"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

type GrpcMetricsReporter struct {
	Registry         *prometheus.Registry
	supportedMetrics map[string]bool

	values       map[string]float64
	addCounter   func(name string, labels map[string]string, count uint64)
	addHistogram func(name string, labels map[string]string, count uint64, sum float64, buckets []uint64)

	onUnexpected func(family *dto.MetricFamily)
}

func NewGrpcMetricsReporter(gitpodHost string) *GrpcMetricsReporter {
	return &GrpcMetricsReporter{
		Registry: prometheus.NewRegistry(),
		supportedMetrics: map[string]bool{
			"grpc_server_handled_total":           true,
			"grpc_server_msg_received_total":      true,
			"grpc_server_msg_sent_total":          true,
			"grpc_server_started_total":           true,
			"grpc_server_handling_seconds":        true,
			"supervisor_ide_ready_duration_total": true,
			"supervisor_initializer_bytes_second": true,
		},
		values: make(map[string]float64),
		addCounter: func(name string, labels map[string]string, value uint64) {
			doAddCounter(gitpodHost, name, labels, value)
		},
		addHistogram: func(name string, labels map[string]string, count uint64, sum float64, buckets []uint64) {
			doAddHistogram(gitpodHost, name, labels, count, sum, buckets)
		},
		onUnexpected: logUnexpectedMetric,
	}
}

func (r *GrpcMetricsReporter) Report(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.gather()
		}
	}
}

func (r *GrpcMetricsReporter) gather() {
	families, err := r.Registry.Gather()
	if err != nil {
		log.WithError(err).Error("supervisor: failed to gather grpc metrics")
		return
	}
	for _, family := range families {
		if family != nil {
			r.reportFamily(family)
		}
	}
}

func (r *GrpcMetricsReporter) isSuppored(family *dto.MetricFamily) bool {
	metricName := family.GetName()
	supported, expected := r.supportedMetrics[metricName]
	if !expected {
		r.supportedMetrics[metricName] = false
		r.onUnexpected(family)
		return false
	}
	return supported
}

func (r *GrpcMetricsReporter) reportFamily(family *dto.MetricFamily) {
	if !r.isSuppored(family) {
		return
	}
	metricName := family.GetName()
	for _, metric := range family.Metric {
		if metric == nil {
			continue
		}
		if metric.Histogram != nil {
			r.reportHistogram(metricName, metric)
		} else if metric.Counter != nil {
			r.reportCounter(metricName, metric)
		}
	}
}

func (r *GrpcMetricsReporter) reportHistogram(name string, metric *dto.Metric) {
	key, labels := computeKey(name, metric)
	count := uint64(r.increase(key+"count", float64(metric.Histogram.GetSampleCount())))
	if count <= 0 {
		return
	}
	sum := r.increase(key, metric.Histogram.GetSampleSum())
	var buckets []uint64
	for i, bucket := range metric.Histogram.GetBucket() {
		buckets = append(buckets, uint64(r.increase(fmt.Sprintf("%s%d", key, i), float64(bucket.GetCumulativeCount()))))
	}
	r.addHistogram(name, labels, count, sum, buckets)
}

func (r *GrpcMetricsReporter) reportCounter(name string, metric *dto.Metric) {
	key, labels := computeKey(name, metric)
	value := uint64(r.increase(key, metric.Counter.GetValue()))
	if value > 0 {
		r.addCounter(name, labels, value)
	}
}

func (r *GrpcMetricsReporter) increase(key string, value float64) float64 {
	prev := r.updateValue(key, value)
	return value - prev
}

func (r *GrpcMetricsReporter) updateValue(key string, value float64) float64 {
	prev := r.values[key]
	r.values[key] = value
	return prev
}

func computeKey(name string, metric *dto.Metric) (string, map[string]string) {
	key := name
	labelPairs := metric.GetLabel()
	labels := make(map[string]string, len(labelPairs))
	for _, labelPair := range metric.GetLabel() {
		labelName := labelPair.GetName()
		labelValue := labelPair.GetValue()
		labels[labelName] = labelValue
		key = key + labelName + labelValue
	}
	return key, labels
}

func logUnexpectedMetric(family *dto.MetricFamily) {
	log.WithField("metric", family.String()).Error("supervisor: unexpected gprc metric")
}

// TODO(ak) refactor to use grpc when ide-proxy supports it
func doAddCounter(gitpodHost string, name string, labels map[string]string, value uint64) {
	req := &api.AddCounterRequest{
		Name:   name,
		Labels: labels,
		Value:  int32(value),
	}
	log.WithField("req", req).Debug("supervisor: gprc metric: add counter")

	body, err := json.Marshal(req)
	if err != nil {
		log.WithField("req", req).WithError(err).Error("supervisor: grpc metric: failed to marshal request")
		return
	}
	url := fmt.Sprintf("https://ide.%s/metrics-api/metrics/counter/add/%s", gitpodHost, name)
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	var statusCode int
	if resp != nil {
		statusCode = resp.StatusCode
	}
	if err == nil && statusCode == http.StatusOK {
		return
	}
	var respBody string
	var status string
	if resp != nil {
		status = resp.Status
		body, _ := ioutil.ReadAll(resp.Body)
		if body != nil {
			respBody = string(body)
		}
	}
	log.WithField("url", url).
		WithField("req", req).
		WithField("statusCode", statusCode).
		WithField("status", status).
		WithField("respBody", respBody).
		WithError(err).
		Error("supervisor: grpc metric: failed to add counter")
}

// TODO(ak) refactor to use grpc when ide-proxy supports it
func doAddHistogram(gitpodHost string, name string, labels map[string]string, count uint64, sum float64, buckets []uint64) {
	req := &api.AddHistogramRequest{
		Name:    name,
		Labels:  labels,
		Count:   count,
		Sum:     sum,
		Buckets: buckets,
	}
	log.WithField("req", req).Debug("supervisor: gprc metric: add histogram")

	body, err := json.Marshal(req)
	if err != nil {
		log.WithField("req", req).WithError(err).Error("supervisor: grpc metric: failed to marshal request")
		return
	}
	url := fmt.Sprintf("https://ide.%s/metrics-api/metrics/histogram/add/%s", gitpodHost, name)
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	var statusCode int
	if resp != nil {
		statusCode = resp.StatusCode
	}
	if err == nil && statusCode == http.StatusOK {
		return
	}
	var respBody string
	var status string
	if resp != nil {
		status = resp.Status
		body, _ := ioutil.ReadAll(resp.Body)
		if body != nil {
			respBody = string(body)
		}
	}
	log.WithField("url", url).
		WithField("req", req).
		WithField("statusCode", statusCode).
		WithField("status", status).
		WithField("respBody", respBody).
		WithError(err).
		Error("supervisor: grpc metric: failed to add histogram")
}
