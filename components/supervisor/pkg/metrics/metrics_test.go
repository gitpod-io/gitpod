// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package metrics

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

func TestHistogram(t *testing.T) {
	reporter := NewGrpcMetricsReporter("test.io")
	type testReq struct {
		Name    string
		Labels  map[string]string
		Count   uint64
		Sum     float64
		Buckets []uint64
	}
	type expectation struct {
		Requests   []*testReq
		Unexpected []string
	}
	var actual *expectation
	reporter.addHistogram = func(name string, labels map[string]string, count uint64, sum float64, buckets []uint64) {
		if actual == nil {
			actual = &expectation{}
		}
		actual.Requests = append(actual.Requests, &testReq{name, labels, count, sum, buckets})
	}
	reporter.onUnexpected = func(family *dto.MetricFamily) {
		if actual == nil {
			actual = &expectation{}
		}
		actual.Unexpected = append(actual.Unexpected, family.GetName())
	}
	assertDiff := func(expected *expectation) string {
		actual = nil
		reporter.gather()
		return cmp.Diff(expected, actual)
	}

	if diff := assertDiff(nil); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "grpc_server_handling_seconds",
		Buckets: []float64{.005, .01, .025},
	}, []string{"grpc_method"})
	err := reporter.Registry.Register(histogram)
	if err != nil {
		t.Fatal(err)
	}
	if diff := assertDiff(nil); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.004)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   1,
			Sum:     0.004,
			Buckets: []uint64{1, 1, 1},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.001)
	histogram.WithLabelValues("foo").Observe(.002)
	histogram.WithLabelValues("foo").Observe(.003)
	histogram.WithLabelValues("foo").Observe(.004)
	histogram.WithLabelValues("foo").Observe(.005)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   5,
			Sum:     0.015,
			Buckets: []uint64{5, 5, 5},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.009)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   1,
			Sum:     0.008999999999999998,
			Buckets: []uint64{0, 1, 1},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.006)
	histogram.WithLabelValues("foo").Observe(.007)
	histogram.WithLabelValues("foo").Observe(.008)
	histogram.WithLabelValues("foo").Observe(.009)
	histogram.WithLabelValues("foo").Observe(.01)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   5,
			Sum:     0.039999999999999994,
			Buckets: []uint64{0, 5, 5},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.001)
	histogram.WithLabelValues("foo").Observe(.002)
	histogram.WithLabelValues("foo").Observe(.003)
	histogram.WithLabelValues("foo").Observe(.004)
	histogram.WithLabelValues("foo").Observe(.005)
	histogram.WithLabelValues("foo").Observe(.006)
	histogram.WithLabelValues("foo").Observe(.007)
	histogram.WithLabelValues("foo").Observe(.008)
	histogram.WithLabelValues("foo").Observe(.009)
	histogram.WithLabelValues("foo").Observe(.01)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   10,
			Sum:     0.05500000000000001,
			Buckets: []uint64{5, 10, 10},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.02)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   1,
			Sum:     0.01999999999999999,
			Buckets: []uint64{0, 0, 1},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.021)
	histogram.WithLabelValues("foo").Observe(.022)
	histogram.WithLabelValues("foo").Observe(.023)
	histogram.WithLabelValues("foo").Observe(.024)
	histogram.WithLabelValues("foo").Observe(.025)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   5,
			Sum:     0.11499999999999996,
			Buckets: []uint64{0, 0, 5},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.001)
	histogram.WithLabelValues("foo").Observe(.002)
	histogram.WithLabelValues("foo").Observe(.003)
	histogram.WithLabelValues("foo").Observe(.004)
	histogram.WithLabelValues("foo").Observe(.005)
	histogram.WithLabelValues("foo").Observe(.006)
	histogram.WithLabelValues("foo").Observe(.007)
	histogram.WithLabelValues("foo").Observe(.008)
	histogram.WithLabelValues("foo").Observe(.009)
	histogram.WithLabelValues("foo").Observe(.01)
	histogram.WithLabelValues("foo").Observe(.021)
	histogram.WithLabelValues("foo").Observe(.022)
	histogram.WithLabelValues("foo").Observe(.023)
	histogram.WithLabelValues("foo").Observe(.024)
	histogram.WithLabelValues("foo").Observe(.025)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   15,
			Sum:     0.17000000000000015,
			Buckets: []uint64{5, 10, 15},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.03)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   1,
			Sum:     0.02999999999999997,
			Buckets: []uint64{0, 0, 0},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.04)
	histogram.WithLabelValues("foo").Observe(.05)
	histogram.WithLabelValues("foo").Observe(.06)
	histogram.WithLabelValues("foo").Observe(.07)
	histogram.WithLabelValues("foo").Observe(.08)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   5,
			Sum:     0.30000000000000004,
			Buckets: []uint64{0, 0, 0},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	histogram.WithLabelValues("foo").Observe(.001)
	histogram.WithLabelValues("foo").Observe(.002)
	histogram.WithLabelValues("foo").Observe(.003)
	histogram.WithLabelValues("foo").Observe(.004)
	histogram.WithLabelValues("foo").Observe(.005)
	histogram.WithLabelValues("foo").Observe(.006)
	histogram.WithLabelValues("foo").Observe(.007)
	histogram.WithLabelValues("foo").Observe(.008)
	histogram.WithLabelValues("foo").Observe(.009)
	histogram.WithLabelValues("foo").Observe(.01)
	histogram.WithLabelValues("foo").Observe(.021)
	histogram.WithLabelValues("foo").Observe(.022)
	histogram.WithLabelValues("foo").Observe(.023)
	histogram.WithLabelValues("foo").Observe(.024)
	histogram.WithLabelValues("foo").Observe(.025)
	histogram.WithLabelValues("foo").Observe(.04)
	histogram.WithLabelValues("foo").Observe(.05)
	histogram.WithLabelValues("foo").Observe(.06)
	histogram.WithLabelValues("foo").Observe(.07)
	histogram.WithLabelValues("foo").Observe(.08)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:    "grpc_server_handling_seconds",
			Labels:  map[string]string{"grpc_method": "foo"},
			Count:   20,
			Sum:     0.4700000000000003,
			Buckets: []uint64{5, 10, 15},
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}
}

func TestCounters(t *testing.T) {
	reporter := NewGrpcMetricsReporter("test.io")
	type testReq struct {
		Name   string
		Labels map[string]string
		Value  uint64
	}
	type expectation struct {
		Requests   []*testReq
		Unexpected []string
	}
	var actual *expectation
	reporter.addCounter = func(name string, labels map[string]string, value uint64) {
		if actual == nil {
			actual = &expectation{}
		}
		actual.Requests = append(actual.Requests, &testReq{name, labels, value})
	}
	reporter.onUnexpected = func(family *dto.MetricFamily) {
		if actual == nil {
			actual = &expectation{}
		}
		actual.Unexpected = append(actual.Unexpected, family.GetName())
	}
	assertDiff := func(expected *expectation) string {
		actual = nil
		reporter.gather()
		return cmp.Diff(expected, actual)
	}

	if diff := assertDiff(nil); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	expectedCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "grpc_server_handled_total",
	}, []string{"grpc_method"})
	err := reporter.Registry.Register(expectedCounter)
	if err != nil {
		t.Fatal(err)
	}
	if diff := assertDiff(nil); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	expectedCounter.WithLabelValues("foo").Add(10)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:   "grpc_server_handled_total",
			Labels: map[string]string{"grpc_method": "foo"},
			Value:  10,
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	expectedCounter.WithLabelValues("foo").Add(30)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:   "grpc_server_handled_total",
			Labels: map[string]string{"grpc_method": "foo"},
			Value:  30,
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	expectedCounter.WithLabelValues("foo").Add(10)
	expectedCounter.WithLabelValues("bar").Add(20)
	if diff := assertDiff(&expectation{
		Requests: []*testReq{{
			Name:   "grpc_server_handled_total",
			Labels: map[string]string{"grpc_method": "bar"},
			Value:  20,
		}, {
			Name:   "grpc_server_handled_total",
			Labels: map[string]string{"grpc_method": "foo"},
			Value:  10,
		}},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	unexpectedCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "some_unexpected_counter_total",
	}, []string{"grpc_method"})
	err = reporter.Registry.Register(unexpectedCounter)
	if err != nil {
		t.Fatal(err)
	}
	if diff := assertDiff(nil); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	unexpectedCounter.WithLabelValues("bazz").Add(20)
	if diff := assertDiff(&expectation{
		Unexpected: []string{"some_unexpected_counter_total"},
	}); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	unexpectedCounter.WithLabelValues("bazz").Add(30)
	if diff := assertDiff(nil); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}
}
