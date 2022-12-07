// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

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
	jobStartedSeconds = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "scheduler_job_started_total",
		Help:      "Number of jobs started",
	}, []string{"job"})

	jobCompletedSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "scheduler_job_completed_seconds",
		Help:      "Histogram of job duration",
		Buckets:   prometheus.LinearBuckets(30, 30, 10), // every 30 secs, starting at 30secs
	}, []string{"job", "outcome"})

	ledgerLastCompletedTime = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "ledger_last_completed_time",
		Help:        "The last time the ledger scheduled job completed, by outcome",
		ConstLabels: nil,
	}, []string{"outcome"})

	stoppedWithoutStoppingTime = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "job_stopped_instances_without_stopping_time_count",
		Help:      "Gauge of usage records where workpsace instance is stopped but doesn't have a stopping time",
	})
)

func RegisterMetrics(reg *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		jobStartedSeconds,
		jobCompletedSeconds,
		stoppedWithoutStoppingTime,
		ledgerLastCompletedTime,
	}
	for _, metric := range metrics {
		err := reg.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}

	return nil
}

func reportJobStarted(id string) {
	jobStartedSeconds.WithLabelValues(id).Inc()
}

func reportJobCompleted(id string, duration time.Duration, err error) {
	jobCompletedSeconds.WithLabelValues(id, outcomeFromErr(err)).Observe(duration.Seconds())
}

func reportLedgerCompleted(err error) {
	ledgerLastCompletedTime.WithLabelValues(outcomeFromErr(err)).SetToCurrentTime()
}

func outcomeFromErr(err error) string {
	out := "success"
	if err != nil {
		out = "error"
	}
	return out
}
