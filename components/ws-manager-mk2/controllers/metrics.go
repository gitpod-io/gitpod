// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/clock"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

// RegisterMetrics registers the Prometheus metrics of this manager
func (r *WorkspaceReconciler) RegisterMetrics(reg prometheus.Registerer) error {
	r.clock.ReportBackwardsTime(
		clock.PrometheusWallTimeMonotonicityReporter(
			prometheus.WrapRegistererWithPrefix(metricsNamespace+metricsWorkspaceSubsystem, reg)))

	return r.metrics.Register(reg)
}

const (
	metricsNamespace          = "gitpod"
	metricsWorkspaceSubsystem = "ws_manager"
)

type metrics struct {
	reconciler *WorkspaceReconciler

	// Histogram
	startupTimeHistVec    *prometheus.HistogramVec
	initializeTimeHistVec *prometheus.HistogramVec
	finalizeTimeHistVec   *prometheus.HistogramVec

	// Counter
	totalStartsCounterVec                     *prometheus.CounterVec
	totalStartsFailureCounterVec              *prometheus.CounterVec
	totalStopsCounterVec                      *prometheus.CounterVec
	totalBackupCounterVec                     *prometheus.CounterVec
	totalBackupFailureCounterVec              *prometheus.CounterVec
	totalRestoreCounterVec                    *prometheus.CounterVec
	totalRestoreFailureCounterVec             *prometheus.CounterVec
	totalUnintentionalWorkspaceStopCounterVec *prometheus.CounterVec
}

func newMetrics(r *WorkspaceReconciler) *metrics {
	return &metrics{
		reconciler: r,
		startupTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_startup_seconds",
			Help:      "time it took for workspace pods to reach the running phase",
			// same as components/ws-manager-bridge/src/prometheus-metrics-exporter.ts#L15
			Buckets: prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
		initializeTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_initialize_seconds",
			Help:      "time it took to initialize workspace",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
		finalizeTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_finalize_seconds",
			Help:      "time it took to finalize workspace",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
		totalStartsCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_starts_total",
			Help:      "total number of workspaces started",
		}, []string{"type", "class"}),
		totalStartsFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_starts_failure_total",
			Help:      "total number of workspaces that failed to start",
		}, []string{"type", "class"}),
		totalStopsCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_stops_total",
			Help:      "total number of workspaces stopped",
		}, []string{"reason", "type", "class"}),
		totalBackupCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_backups_total",
			Help:      "total number of workspace backups",
		}, []string{"type", "class"}),
		totalBackupFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_backups_failure_total",
			Help:      "total number of workspace backup failures",
		}, []string{"type", "class"}),
		totalRestoreCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_restores_total",
			Help:      "total number of workspace restores",
		}, []string{"type", "class"}),
		totalRestoreFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_restores_failure_total",
			Help:      "total number of workspace restore failures",
		}, []string{"type", "class"}),
		totalUnintentionalWorkspaceStopCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_unintentional_stop_total",
			Help:      "total number of workspaces when container stopped without being deleted prior",
		}, []string{"type", "class"}),
	}
}

// Register registers all metrics ws-manager can export
func (m *metrics) Register(reg prometheus.Registerer) error {
	collectors := []prometheus.Collector{
		m.startupTimeHistVec,
		m.initializeTimeHistVec,
		m.finalizeTimeHistVec,
		newPhaseTotalVec(m.reconciler),
		newTimeoutSettingsVec(m.reconciler),
		m.totalStartsCounterVec,
		m.totalStartsFailureCounterVec,
		m.totalStopsCounterVec,
		m.totalBackupCounterVec,
		m.totalBackupFailureCounterVec,
		m.totalRestoreCounterVec,
		m.totalRestoreFailureCounterVec,
		m.totalUnintentionalWorkspaceStopCounterVec,
	}

	for _, c := range collectors {
		err := reg.Register(c)
		if err != nil {
			return err
		}
	}

	return nil
}

// phaseTotalVec returns a gauge vector counting the workspaces per phase
type phaseTotalVec struct {
	name       string
	desc       *prometheus.Desc
	reconciler *WorkspaceReconciler
}

func newPhaseTotalVec(r *WorkspaceReconciler) *phaseTotalVec {
	name := prometheus.BuildFQName(metricsNamespace, metricsWorkspaceSubsystem, "workspace_phase_total")
	return &phaseTotalVec{
		name:       name,
		desc:       prometheus.NewDesc(name, "Current number of workspaces per phase", []string{"phase", "type", "class"}, prometheus.Labels(map[string]string{})),
		reconciler: r,
	}
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (ptv *phaseTotalVec) Describe(ch chan<- *prometheus.Desc) {
	ch <- ptv.desc
}

// Collect implements Collector.
func (ptv *phaseTotalVec) Collect(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), kubernetesOperationTimeout)
	defer cancel()

	var workspaces workspacev1.WorkspaceList
	err := ptv.reconciler.List(ctx, &workspaces, client.InNamespace(ptv.reconciler.Config.Namespace))
	if err != nil {
		log.WithError(err).Debugf("cannot list workspaces for %s gauge", ptv.name)
		return
	}

	counts := make(map[string]int)
	for _, ws := range workspaces.Items {
		counts[string(ws.Spec.Type)+"::"+string(ws.Status.Phase)+"::"+ws.Spec.Class]++
	}

	for key, count := range counts {
		segs := strings.Split(key, "::")
		tpe, phase, class := segs[0], segs[1], segs[2]

		metric, err := prometheus.NewConstMetric(ptv.desc, prometheus.GaugeValue, float64(count), phase, tpe, class)
		if err != nil {
			log.WithError(err).Warnf("cannot create workspace metric - %s will be inaccurate", ptv.name)
			continue
		}

		ch <- metric
	}
}

// timeoutSettingsVec provides a gauge of the currently active/inactive workspaces.
// Adding both up returns the total number of workspaces.
type timeoutSettingsVec struct {
	name       string
	reconciler *WorkspaceReconciler
	desc       *prometheus.Desc
}

func newTimeoutSettingsVec(r *WorkspaceReconciler) *timeoutSettingsVec {
	name := prometheus.BuildFQName("wsman", "workspace", "timeout_settings_total")
	desc := prometheus.NewDesc(
		name,
		"Current number of workspaces per timeout setting",
		[]string{"timeout"},
		prometheus.Labels(map[string]string{}),
	)
	return &timeoutSettingsVec{
		name:       name,
		reconciler: r,
		desc:       desc,
	}
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (vec *timeoutSettingsVec) Describe(ch chan<- *prometheus.Desc) {
	ch <- vec.desc
}

// Collect implements Collector.
func (tsv *timeoutSettingsVec) Collect(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), kubernetesOperationTimeout)
	defer cancel()

	var workspaces workspacev1.WorkspaceList
	err := tsv.reconciler.List(ctx, &workspaces, client.InNamespace(tsv.reconciler.Config.Namespace))
	if err != nil {
		log.WithError(err).Debugf("cannot list workspaces for %s gauge", tsv.name)
		return
	}

	timeouts := make(map[time.Duration]int)
	for _, ws := range workspaces.Items {
		if ws.Spec.Timeout.Time == nil {
			continue
		}

		timeouts[ws.Spec.Timeout.Time.Duration]++
	}

	for phase, cnt := range timeouts {
		// metrics cannot be re-used, we have to create them every single time
		metric, err := prometheus.NewConstMetric(tsv.desc, prometheus.GaugeValue, float64(cnt), phase.String())
		if err != nil {
			log.WithError(err).Warnf("cannot create workspace metric - %s will be inaccurate", tsv.name)
			continue
		}

		ch <- metric
	}
}
