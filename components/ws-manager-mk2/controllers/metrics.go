// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"strings"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/maintenance"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/go-logr/logr"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	maintenanceEnabled            string = "maintenance_enabled"
	workspaceStartupSeconds       string = "workspace_startup_seconds"
	workspaceStartFailuresTotal   string = "workspace_starts_failure_total"
	workspaceFailuresTotal        string = "workspace_failure_total"
	workspaceStopsTotal           string = "workspace_stops_total"
	workspaceBackupsTotal         string = "workspace_backups_total"
	workspaceBackupFailuresTotal  string = "workspace_backups_failure_total"
	workspaceRestoresTotal        string = "workspace_restores_total"
	workspaceRestoresFailureTotal string = "workspace_restores_failure_total"
)

type StopReason string

const (
	StopReasonFailed       = "failed"
	StopReasonStartFailure = "start-failure"
	StopReasonAborted      = "aborted"
	StopReasonOutOfSpace   = "out-of-space"
	StopReasonTimeout      = "timeout"
	StopReasonTabClosed    = "tab-closed"
	StopReasonRegular      = "regular-stop"
)

type controllerMetrics struct {
	startupTimeHistVec           *prometheus.HistogramVec
	totalStartsFailureCounterVec *prometheus.CounterVec
	totalFailuresCounterVec      *prometheus.CounterVec
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
		totalFailuresCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      workspaceFailuresTotal,
			Help:      "total number of workspaces that had a failed condition",
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

	duration := time.Since(ws.CreationTimestamp.Time)
	hist.Observe(float64(duration.Seconds()))
}

func (m *controllerMetrics) countWorkspaceStartFailures(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	m.totalStartsFailureCounterVec.WithLabelValues(tpe, class).Inc()
}

func (m *controllerMetrics) countWorkspaceFailure(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	m.totalFailuresCounterVec.WithLabelValues(tpe, class).Inc()
}

func (m *controllerMetrics) countWorkspaceStop(log *logr.Logger, ws *workspacev1.Workspace) {
	var reason string
	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)); c != nil {
		reason = StopReasonFailed
		if !ws.IsConditionTrue(workspacev1.WorkspaceConditionEverReady) {
			// Don't record 'failed' if there was a start failure.
			reason = StopReasonStartFailure
		} else if strings.Contains(c.Message, "Pod ephemeral local storage usage exceeds the total limit of containers") {
			reason = StopReasonOutOfSpace
		}
	} else if ws.IsConditionTrue(workspacev1.WorkspaceConditionAborted) {
		reason = StopReasonAborted
	} else if ws.IsConditionTrue(workspacev1.WorkspaceConditionTimeout) {
		reason = StopReasonTimeout
	} else if ws.IsConditionTrue(workspacev1.WorkspaceConditionClosed) {
		reason = StopReasonTabClosed
	} else {
		reason = StopReasonRegular
	}

	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	m.totalStopsCounterVec.WithLabelValues(reason, tpe, class).Inc()
}

func (m *controllerMetrics) countTotalBackups(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	m.totalBackupCounterVec.WithLabelValues(tpe, class).Inc()
}

func (m *controllerMetrics) countTotalBackupFailures(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	m.totalBackupFailureCounterVec.WithLabelValues(tpe, class).Inc()
}

func (m *controllerMetrics) countTotalRestores(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	m.totalRestoreCounterVec.WithLabelValues(tpe, class).Inc()
}

func (m *controllerMetrics) countTotalRestoreFailures(log *logr.Logger, ws *workspacev1.Workspace) {
	class := ws.Spec.Class
	tpe := string(ws.Spec.Type)

	m.totalRestoreFailureCounterVec.WithLabelValues(tpe, class).Inc()
}

func (m *controllerMetrics) containsWorkspace(ws *workspacev1.Workspace) bool {
	return m.cache.Contains(ws.Name)
}

func (m *controllerMetrics) rememberWorkspace(ws *workspacev1.Workspace, state *metricState) {
	var s metricState
	if state != nil {
		s = *state
	} else {
		s = newMetricState(ws)
	}
	m.cache.Add(ws.Name, s)
}

func (m *controllerMetrics) forgetWorkspace(ws *workspacev1.Workspace) {
	m.cache.Remove(ws.Name)
}

// metricState is used to track which metrics have been recorded for a workspace.
type metricState struct {
	phase                   workspacev1.WorkspacePhase
	recordedStartTime       bool
	recordedInitFailure     bool
	recordedStartFailure    bool
	recordedFailure         bool
	recordedContentReady    bool
	recordedBackupFailed    bool
	recordedBackupCompleted bool
}

func newMetricState(ws *workspacev1.Workspace) metricState {
	return metricState{
		phase: ws.Status.Phase,
		// Here we assume that we've recorded metrics for the following states already if their conditions already exist.
		// This is to prevent these from being re-recorded after the controller restarts and clears the metric state for
		// each workspace.
		recordedStartTime:       ws.Status.Phase == workspacev1.WorkspacePhaseRunning,
		recordedInitFailure:     wsk8s.ConditionWithStatusAndReason(ws.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, workspacev1.ReasonInitializationFailure),
		recordedStartFailure:    ws.Status.Phase == workspacev1.WorkspacePhaseStopped && isStartFailure(ws),
		recordedFailure:         ws.IsConditionTrue(workspacev1.WorkspaceConditionFailed),
		recordedContentReady:    ws.IsConditionTrue(workspacev1.WorkspaceConditionContentReady),
		recordedBackupFailed:    ws.IsConditionTrue(workspacev1.WorkspaceConditionBackupFailure),
		recordedBackupCompleted: ws.IsConditionTrue(workspacev1.WorkspaceConditionBackupComplete),
	}
}

// getWorkspace returns the last recorded metric state for that workspace.
func (m *controllerMetrics) getWorkspace(log *logr.Logger, ws *workspacev1.Workspace) (bool, metricState) {
	s, ok := m.cache.Get(ws.Name)
	if !ok {
		return false, metricState{}
	}

	return true, s.(metricState)
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (m *controllerMetrics) Describe(ch chan<- *prometheus.Desc) {
	m.startupTimeHistVec.Describe(ch)
	m.totalStopsCounterVec.Describe(ch)
	m.totalStartsFailureCounterVec.Describe(ch)
	m.totalFailuresCounterVec.Describe(ch)

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
	m.totalFailuresCounterVec.Collect(ch)

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

type maintenanceEnabledGauge struct {
	name        string
	desc        *prometheus.Desc
	maintenance maintenance.Maintenance
}

func newMaintenanceEnabledGauge(m maintenance.Maintenance) *maintenanceEnabledGauge {
	name := prometheus.BuildFQName(metricsNamespace, metricsWorkspaceSubsystem, maintenanceEnabled)
	return &maintenanceEnabledGauge{
		name:        name,
		desc:        prometheus.NewDesc(name, "Whether the cluster is in maintenance mode", nil, prometheus.Labels(map[string]string{})),
		maintenance: m,
	}
}

func (m *maintenanceEnabledGauge) Describe(ch chan<- *prometheus.Desc) {
	ch <- m.desc
}

func (m *maintenanceEnabledGauge) Collect(ch chan<- prometheus.Metric) {
	var value float64
	if m.maintenance.IsEnabled(context.Background()) {
		value = 1
	}

	metric, err := prometheus.NewConstMetric(m.desc, prometheus.GaugeValue, value)
	if err != nil {
		return
	}

	ch <- metric
}
