// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"fmt"
	"github.com/prometheus/client_golang/prometheus"
	"time"
)

const (
	namespace = "gitpod"
	subsystem = "usage"
)

var (
	reconcileStartedTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "reconcile_started_total",
		Help:      "Number of usage reconciliation runs started",
	}, []string{})

	reconcileStartedDurationSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "reconcile_completed_duration_seconds",
		Help:      "Histogram of reconcile duration",
		Buckets:   prometheus.LinearBuckets(30, 30, 10), // every 30 secs, starting at 30secs
	}, []string{"outcome"})
)

func RegisterMetrics(reg *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		reconcileStartedTotal,
		reconcileStartedDurationSeconds,
	}
	for _, metric := range metrics {
		err := reg.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}

	return nil
}

func reportUsageReconcileStarted() {
	reconcileStartedTotal.WithLabelValues().Inc()
}

func reportUsageReconcileFinished(duration time.Duration, err error) {
	outcome := "success"
	if err != nil {
		outcome = "error"
	}
	reconcileStartedDurationSeconds.WithLabelValues(outcome).Observe(duration.Seconds())
}
