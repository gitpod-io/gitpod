// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
		Name:      "scheduler_job_started",
		Help:      "Number of jobs started",
	}, []string{"job"})

	jobCompletedSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "scheduler_job_completed_seconds",
		Help:      "Histogram of job duration",
		Buckets:   prometheus.LinearBuckets(30, 30, 10), // every 30 secs, starting at 30secs
	}, []string{"job", "outcome"})
)

func RegisterMetrics(reg *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		jobStartedSeconds,
		jobCompletedSeconds,
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
	outcome := "success"
	if err != nil {
		outcome = "error"
	}
	jobCompletedSeconds.WithLabelValues(id, outcome).Observe(duration.Seconds())
}
