// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package stripe

import (
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stripe/stripe-go/v72"
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
	}, []string{"resource"})

	stripeClientRequestsCompletedSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "gitpod",
		Subsystem: "stripe",
		Name:      "requests_completed_seconds",
		Help:      "Histogram of requests completed by stripe clients",
	}, []string{"resource", "code"})
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

func reportStripeRequestStarted(resource string) {
	stripeClientRequestsStarted.WithLabelValues(resource).Inc()
}

func reportStripeRequestCompleted(resource string, err error, took time.Duration) {
	code := "ok"
	if err != nil {
		code = "unknown"
		if stripeErr, ok := err.(*stripe.Error); ok {
			code = string(stripeErr.Code)
		}
	}

	stripeClientRequestsCompletedSeconds.WithLabelValues(resource, code).Observe(took.Seconds())
}
