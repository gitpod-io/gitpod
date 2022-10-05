// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	stripeUsageUpdateTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "stripe",
		Name:      "usage_records_updated_total",
		Help:      "Counter of usage records updated",
	}, []string{"outcome"})

	stripeClientRequestsStarted = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "stripe",
		Name:      "requests_started_total",
		Help:      "Counter of requests started by stripe clients",
	}, []string{"method", "path"})

	stripeClientRequestsCompletedSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "gitpod",
		Subsystem: "stripe",
		Name:      "requests_completed_seconds",
		Help:      "Histogram of requests completed by stripe clients",
	}, []string{"method", "path", "code"})
)

func RegisterMetrics(reg *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		stripeUsageUpdateTotal,
		stripeClientRequestsStarted,
		stripeClientRequestsCompletedSeconds,
	}
	for _, metric := range metrics {
		err := reg.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}

	return nil
}

func reportStripeUsageUpdate(err error) {
	outcome := "success"
	if err != nil {
		outcome = "fail"
	}
	stripeUsageUpdateTotal.WithLabelValues(outcome).Inc()
}

type stripeRoundTripper struct {
	next http.RoundTripper
}

func (rt *stripeRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	now := time.Now()
	path := r.URL.Path
	method := r.Method
	stripeClientRequestsStarted.WithLabelValues(method, path).Inc()

	resp, err := rt.next.RoundTrip(r)
	took := time.Since(now)
	code := 0
	if err == nil && resp != nil {
		code = resp.StatusCode
	}

	stripeClientRequestsCompletedSeconds.WithLabelValues(method, path, strconv.Itoa(code)).Observe(took.Seconds())
	return resp, err
}

func StripeClientMetricsRoundTripper(next http.RoundTripper) http.RoundTripper {
	return &stripeRoundTripper{next: next}
}
