// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"strings"
	"time"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/go-logr/logr"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	workspaceStartupSeconds       string = "workspace_startup_seconds"
	workspaceStartFailuresTotal   string = "workspace_starts_failure_total"
	workspaceStopsTotal           string = "workspace_stops_total"
	workspaceBackupsTotal         string = "workspace_backups_total"
	workspaceBackupFailuresTotal  string = "workspace_backups_failure_total"
	workspaceRestoresTotal        string = "workspace_restores_total"
	workspaceRestoresFailureTotal string = "workspace_restores_failure_total"
)

type controllerMetrics struct {
	startupTimeHistVec           *prometheus.HistogramVec
	totalStartsFailureCounterVec *prometheus.CounterVec
	totalStopsCounterVec         *prometheus.CounterVec

	totalBackupCounterVec         *prometheus.CounterVec
	totalBackupFailureCounterVec  *prometheus.CounterVec
	totalRestoreCounterVec        *prometheus.CounterVec
	totalRestoreFailureCounterVec *prometheus.CounterVec

	workspacePhases *phaseTotalVec
	timeoutSettings *timeoutSettingsVec

	// used to prevent recording metrics multiple times
	cache *lru.Cache
}

func newControllerMetrics(r *WorkspaceReconciler) (*controllerMetrics, error) {
	cache, err := lru.New(6000)
	if err != nil {
		return nil, err
	}

	return &controllerMetrics{
		startupTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceStartupSeconds,
			Help:      "time it took for workspace pods to reach the running phase",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
		totalStartsFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceStartFailuresTotal,
			Help:      "total number of workspaces that failed to start",
		}, []string{"type", "class"}),
		totalStopsCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceStopsTotal,
			Help:      "total number of workspaces stopped",
		}, []string{"reason", "type", "class"}),

		totalBackupCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceBackupsTotal,
			Help:      "total number of workspace backups",
		}, []string{"type", "class"}),
		totalBackupFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceBackupFailuresTotal,
			Help:      "total number of workspace backup failures",
		}, []string{"type", "class"}),
		totalRestoreCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceRestoresTotal,
			Help:      "total number of workspace restores",
		}, []string{"type", "class"}),
		totalRestoreFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceRestoresFailureTotal,
			Help:      "total number of workspace restore failures",
		}, []string{"type", "class"}),

		workspacePhases: newPhaseTotalVec(r),
		timeoutSettings: newTimeoutSettingsVec(r),
		cache:           cache,
	}, nil
}

func (m *controllerMetrics) recordWorkspaceStartupTime(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	hist, err := m.startupTimeHistVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.Error(err, "could not record workspace startup time", "type", tpe, "class", class)
	}

	hist.Observe(float64(time.Since(ws.CreationTimestamp.Time).Seconds()))
}

func (m *controllerMetrics) countWorkspaceStartFailures(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	counter, err := m.totalStartsFailureCounterVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.Error(err, "could not count workspace startup failure", "type", tpe, "class", class)
	}

	counter.Inc()
}

func (m *controllerMetrics) countWorkspaceStop(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	counter, err := m.totalStopsCounterVec.GetMetricWithLabelValues("unknown", tpe, class)
	if err != nil {
		log.Error(err, "could not count workspace stop", "reason", "unknown", "type", tpe, "class", class)
	}

	counter.Inc()
}

func (m *controllerMetrics) countTotalBackups(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	counter, err := m.totalBackupCounterVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.Error(err, "could not count workspace backup", "type", tpe, "class", class)
	}

	counter.Inc()
}

func (m *controllerMetrics) countTotalBackupFailures(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	counter, err := m.totalBackupFailureCounterVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.Error(err, "could not count workspace backup failure", "type", tpe, "class", class)
	}

	counter.Inc()
}

func (m *controllerMetrics) countTotalRestores(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	counter, err := m.totalRestoreCounterVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.Error(err, "could not count workspace restore", "type", tpe, "class", class)
	}

	counter.Inc()
}

func (m *controllerMetrics) countTotalRestoreFailures(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	counter, err := m.totalRestoreFailureCounterVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.Error(err, "could not count workspace restore failure", "type", tpe, "class", class)
	}

	counter.Inc()
}

func (m *controllerMetrics) rememberWorkspace(ws *workspacev1.Workspace) {
	m.cache.Add(ws.Name, ws.Status.Phase)
}

func (m *controllerMetrics) forgetWorkspace(ws *workspacev1.Workspace) {
	m.cache.Remove(ws.Name)
}

func (m *controllerMetrics) shouldUpdate(log *logr.Logger, ws *workspacev1.Workspace) bool {
	p, ok := m.cache.Get(ws.Name)
	if !ok {
		return false
	}

	phase := p.(workspacev1.WorkspacePhase)
	return phase != ws.Status.Phase
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (m *controllerMetrics) Describe(ch chan<- *prometheus.Desc) {
	m.startupTimeHistVec.Describe(ch)
	m.totalStopsCounterVec.Describe(ch)
	m.totalStartsFailureCounterVec.Describe(ch)

	m.totalBackupCounterVec.Describe(ch)
	m.totalBackupFailureCounterVec.Describe(ch)
	m.totalRestoreCounterVec.Describe(ch)
	m.totalRestoreFailureCounterVec.Describe(ch)

	m.workspacePhases.Describe(ch)
	m.timeoutSettings.Describe(ch)
}

// Collect implements Collector.
func (m *controllerMetrics) Collect(ch chan<- prometheus.Metric) {
	m.startupTimeHistVec.Collect(ch)
	m.totalStopsCounterVec.Collect(ch)
	m.totalStartsFailureCounterVec.Collect(ch)

	m.totalBackupCounterVec.Collect(ch)
	m.totalBackupFailureCounterVec.Collect(ch)
	m.totalRestoreCounterVec.Collect(ch)
	m.totalRestoreFailureCounterVec.Collect(ch)

	m.workspacePhases.Collect(ch)
	m.timeoutSettings.Collect(ch)
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
			continue
		}

		ch <- metric
	}
}
