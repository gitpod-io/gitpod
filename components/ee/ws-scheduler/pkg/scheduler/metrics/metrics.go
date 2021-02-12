// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// All the histogram based metrics have 1ms as size for the smallest bucket.
var (
	ScheduleAttempts = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "schedule_attempts_total",
			Help: "Number of attempts to schedule pods, by the result. 'unschedulable' means a pod could not be scheduled, while 'error' means an internal scheduler problem.",
		}, []string{"result", "workspaceType"})
	E2eSchedulingLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "e2e_scheduling_duration_seconds",
			Help:    "E2e scheduling latency in seconds (scheduling algorithm + binding)",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15),
		}, []string{"result", "workspaceType"})
	BindingLatency = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "binding_duration_seconds",
			Help:    "Binding latency in seconds",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15),
		},
	)
	PreemptionAttempts = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "preemption_attempts_total",
			Help: "Total preemption attempts in the cluster till now",
		})
	PendingPods = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pending_pods",
			Help: "Number of pending pods, by the queue type. 'active' means number of pods in activeQ; 'backoff' means number of pods in backoffQ.",
		}, []string{"queue", "workspaceType"})
	PodSchedulingDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "pod_scheduling_duration_seconds",
			Help: "E2e latency for a pod being scheduled which may include multiple scheduling attempts.",
			// Start with 10ms with the last bucket being [~88m, Inf).
			Buckets: prometheus.ExponentialBuckets(0.01, 2, 20),
		},
		[]string{"attempts", "workspaceType"})

	PodSchedulingAttempts = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "pod_scheduling_attempts",
			Help:    "Number of attempts to successfully schedule a pod.",
			Buckets: prometheus.ExponentialBuckets(1, 2, 5),
		},
		[]string{"attempts", "workspaceType"})

	AllMetrics = []prometheus.Collector{
		ScheduleAttempts,
		E2eSchedulingLatency,
		BindingLatency,
		PreemptionAttempts,
		PendingPods,
		PodSchedulingDuration,
		PodSchedulingAttempts,
	}
)

var (
	scheduledResult     = "scheduled"
	unschedulableResult = "unschedulable"
	errorResult         = "error"
)

// PodScheduled can records a successful scheduling attempt and the duration
// since `start`.
func PodScheduled(workspaceType string, duration float64) {
	observeScheduleAttemptAndLatency(scheduledResult, workspaceType, duration)
}

// PodUnschedulable can records a scheduling attempt for an unschedulable pod
// and the duration since `start`.
func PodUnschedulable(workspaceType string, duration float64) {
	observeScheduleAttemptAndLatency(unschedulableResult, workspaceType, duration)
}

// PodScheduleError can records a scheduling attempt that had an error and the
// duration since `start`.
func PodScheduleError(workspaceType string, duration float64) {
	observeScheduleAttemptAndLatency(errorResult, workspaceType, duration)
}

func observeScheduleAttemptAndLatency(result, workspaceType string, duration float64) {
	E2eSchedulingLatency.WithLabelValues(result, workspaceType).Observe(duration)
	ScheduleAttempts.WithLabelValues(result, workspaceType).Inc()
}

// SinceInSeconds gets the time since the specified start in seconds.
func SinceInSeconds(start time.Time) float64 {
	return time.Since(start).Seconds()
}
