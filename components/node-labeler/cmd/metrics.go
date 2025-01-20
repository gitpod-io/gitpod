// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import "github.com/prometheus/client_golang/prometheus"

const (
	metricsNamespace          = "gitpod"
	metricsWorkspaceSubsystem = "node_labeler"
)

var (
	NodeLabelerCounterVec = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsWorkspaceSubsystem,
		Name:      "reconcile_total",
		Help:      "Total number of reconciliations per component",
	}, []string{"component"})

	NodeLabelerTimeHistVec = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsWorkspaceSubsystem,
		Name:      "ready_seconds",
		Help:      "time it took for a pods to reach the running phase and the ready label was applied to the node",
		Buckets:   []float64{5, 10, 15, 20, 25, 30, 45, 60, 75},
	}, []string{"component"})

	// Track reconciliation durations for the NodeScaledownAnnotationController
	NodeScaledownAnnotationReconcileDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsWorkspaceSubsystem,
		Name:      "node_scaledown_annotation_reconcile_duration_seconds",
		Help:      "Duration of NodeScaledownAnnotationController reconciliations",
		Buckets:   []float64{0.1, 0.5, 1, 2.5, 5, 10, 30},
	}, []string{"operation"})

	// Track queue size for the NodeScaledownAnnotationController
	NodeScaledownAnnotationReconciliationQueueSize = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsWorkspaceSubsystem,
		Name:      "node_scaledown_annotation_reconciliation_queue_size",
		Help:      "Current size of the NodeScaledownAnnotationController reconciliation queue",
	})
)
