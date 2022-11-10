// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	corev1 "k8s.io/api/core/v1"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/clock"
)

// RegisterMetrics registers the Prometheus metrics of this manager
func (m *Manager) RegisterMetrics(reg prometheus.Registerer) error {
	m.clock.ReportBackwardsTime(
		clock.PrometheusWallTimeMonotonicityReporter(
			prometheus.WrapRegistererWithPrefix(metricsNamespace+metricsWorkspaceSubsystem, reg)))

	return m.metrics.Register(reg)
}

const (
	metricsNamespace          = "gitpod"
	metricsWorkspaceSubsystem = "ws_manager"
)

type metrics struct {
	manager *Manager

	// Histogram
	startupTimeHistVec        *prometheus.HistogramVec
	initializeTimeHistVec     *prometheus.HistogramVec
	finalizeTimeHistVec       *prometheus.HistogramVec
	volumeSnapshotTimeHistVec *prometheus.HistogramVec
	volumeRestoreTimeHistVec  *prometheus.HistogramVec

	// Counter
	totalStartsCounterVec                     *prometheus.CounterVec
	totalStopsCounterVec                      *prometheus.CounterVec
	totalBackupCounterVec                     *prometheus.CounterVec
	totalBackupFailureCounterVec              *prometheus.CounterVec
	totalRestoreCounterVec                    *prometheus.CounterVec
	totalRestoreFailureCounterVec             *prometheus.CounterVec
	totalUnintentionalWorkspaceStopCounterVec *prometheus.CounterVec
	totalMountDeviceFailedVec                 *prometheus.CounterVec
	totalCannotMountVolumeVec                 *prometheus.CounterVec

	// Gauge
	totalOpenPortGauge prometheus.GaugeFunc

	mu         sync.Mutex
	phaseState map[string]api.WorkspacePhase
}

func newMetrics(m *Manager) *metrics {
	return &metrics{
		manager:    m,
		phaseState: make(map[string]api.WorkspacePhase),
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
		volumeSnapshotTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "volume_snapshot_seconds",
			Help:      "time it took to snapshot volume",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
		volumeRestoreTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "volume_restore_seconds",
			Help:      "time it took to restore volume",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
		totalStartsCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_starts_total",
			Help:      "total number of workspaces started",
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
		}, []string{"type", "pvc", "class"}),
		totalBackupFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_backups_failure_total",
			Help:      "total number of workspace backup failures",
		}, []string{"type", "pvc", "class"}),
		totalRestoreCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_restores_total",
			Help:      "total number of workspace restores",
		}, []string{"type", "pvc", "class"}),
		totalRestoreFailureCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_restores_failure_total",
			Help:      "total number of workspace restore failures",
		}, []string{"type", "pvc", "class"}),
		totalUnintentionalWorkspaceStopCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_unintentional_stop_total",
			Help:      "total number of workspaces when container stopped without being deleted prior",
		}, []string{"type", "class"}),
		totalMountDeviceFailedVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_mount_device_failed",
			Help:      "total number of workspace mount device failed",
		}, []string{"type", "class"}),
		totalCannotMountVolumeVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_cannot_mount_volume",
			Help:      "total number of workspace cannot mount volume",
		}, []string{"type", "class"}),
		totalOpenPortGauge: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "exposed_ports",
			Help:      "total number of currently exposed ports",
		}, newTotalOpenPortGaugeHandler(m)),
	}
}

func newTotalOpenPortGaugeHandler(m *Manager) func() float64 {
	countExposedPorts := func(ctx context.Context) (float64, error) {
		var l corev1.ServiceList
		err := m.Clientset.List(ctx, &l, workspaceObjectListOptions(m.Config.Namespace))
		if err != nil {
			return 0, err
		}
		var portCount int
		for _, s := range l.Items {
			tpe, ok := s.Labels[wsk8s.ServiceTypeLabel]
			if !ok {
				continue
			}
			if tpe != "ports" {
				continue
			}
			portCount += len(s.Spec.Ports)
		}
		return float64(portCount), nil
	}

	return func() float64 {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		r, err := countExposedPorts(ctx)
		if err != nil {
			log.WithError(err).Warn("cannot compute exposed_ports metric")
			return math.NaN()
		}

		return r
	}
}

// Register registers all metrics ws-manager can export
func (m *metrics) Register(reg prometheus.Registerer) error {
	collectors := []prometheus.Collector{
		m.startupTimeHistVec,
		m.initializeTimeHistVec,
		m.finalizeTimeHistVec,
		m.volumeSnapshotTimeHistVec,
		m.volumeRestoreTimeHistVec,
		newPhaseTotalVec(m.manager),
		newWorkspaceActivityVec(m.manager),
		newTimeoutSettingsVec(m.manager),
		newSubscriberQueueLevelVec(m.manager),
		m.totalStartsCounterVec,
		m.totalStopsCounterVec,
		m.totalBackupCounterVec,
		m.totalBackupFailureCounterVec,
		m.totalRestoreCounterVec,
		m.totalRestoreFailureCounterVec,
		m.totalUnintentionalWorkspaceStopCounterVec,
		m.totalMountDeviceFailedVec,
		m.totalCannotMountVolumeVec,
		m.totalOpenPortGauge,
	}
	for _, c := range collectors {
		err := reg.Register(c)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *metrics) OnWorkspaceStarted(tpe api.WorkspaceType, class string) {
	nme := api.WorkspaceType_name[int32(tpe)]
	counter, err := m.totalStartsCounterVec.GetMetricWithLabelValues(nme, class)
	if err != nil {
		log.WithError(err).WithField("type", tpe).Warn("cannot get counter for workspace start metric")
		return
	}

	counter.Inc()
}

func (m *metrics) OnChange(status *api.WorkspaceStatus) {
	var removeFromState bool
	tpe := api.WorkspaceType_name[int32(status.Spec.Type)]
	m.mu.Lock()
	defer func() {
		if removeFromState {
			delete(m.phaseState, status.Id)
		} else {
			m.phaseState[status.Id] = status.Phase
		}
		m.mu.Unlock()
	}()

	switch status.Phase {
	case api.WorkspacePhase_RUNNING:
		if status.Metadata.StartedAt == nil {
			return
		}
		countedAlready := m.phaseState[status.Id] == api.WorkspacePhase_RUNNING
		if countedAlready {
			return
		}

		t := status.Metadata.StartedAt.AsTime()
		hist, err := m.startupTimeHistVec.GetMetricWithLabelValues(tpe, status.Spec.Class)
		if err != nil {
			log.WithError(err).WithField("type", tpe).Warn("cannot get startup time histogram metric")
			return
		}
		hist.Observe(time.Since(t).Seconds())

	case api.WorkspacePhase_STOPPED:
		var reason string
		if strings.Contains(status.Message, string(activityClosed)) {
			reason = "tab-closed"
		} else if strings.Contains(status.Message, "workspace timed out") {
			reason = "timeout"
		} else if status.Conditions.Aborted == api.WorkspaceConditionBool_TRUE {
			reason = "aborted"
		} else if status.Conditions.Failed != "" {
			reason = "failed"
		} else {
			reason = "regular-stop"
		}

		counter, err := m.totalStopsCounterVec.GetMetricWithLabelValues(reason, tpe, status.Spec.Class)
		if err != nil {
			log.WithError(err).WithField("reason", reason).Warn("cannot get counter for workspace stops metric")
			return
		}
		counter.Inc()
		removeFromState = true
	}
}

// phaseTotalVec returns a gauge vector counting the workspaces per phase
type phaseTotalVec struct {
	name    string
	desc    *prometheus.Desc
	manager *Manager

	mu sync.Mutex
}

func newPhaseTotalVec(m *Manager) *phaseTotalVec {
	name := prometheus.BuildFQName(metricsNamespace, metricsWorkspaceSubsystem, "workspace_phase_total")
	return &phaseTotalVec{
		name:    name,
		desc:    prometheus.NewDesc(name, "Current number of workspaces per phase", []string{"phase", "type", "class"}, prometheus.Labels(map[string]string{})),
		manager: m,
	}
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (m *phaseTotalVec) Describe(ch chan<- *prometheus.Desc) {
	ch <- m.desc
}

// Collect implements Collector.
func (m *phaseTotalVec) Collect(ch chan<- prometheus.Metric) {
	m.mu.Lock()
	defer m.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), kubernetesOperationTimeout)
	defer cancel()

	var pods corev1.PodList
	err := m.manager.Clientset.List(ctx, &pods, workspaceObjectListOptions(m.manager.Config.Namespace))
	if err != nil {
		log.WithError(err).Debugf("cannot list workspaces for %s gauge", m.name)
		return
	}

	counts := make(map[string]int)
	for _, pod := range pods.Items {
		wso := workspaceObjects{Pod: &pod}

		rawStatus, err := m.manager.getWorkspaceStatus(wso)
		if err != nil {
			log.WithFields(wso.GetOWI()).WithError(err).Warnf("cannot get workspace status - %s will be inaccurate", m.name)
			continue
		}
		status := api.WorkspacePhase_name[int32(rawStatus.Phase)]
		tpe := api.WorkspaceType_name[int32(rawStatus.Spec.Type)]
		class := rawStatus.Spec.Class

		counts[tpe+"::"+status+"::"+class]++
	}

	for key, cnt := range counts {
		segs := strings.Split(key, "::")
		tpe, phase, class := segs[0], segs[1], segs[2]

		// metrics cannot be re-used, we have to create them every single time
		metric, err := prometheus.NewConstMetric(m.desc, prometheus.GaugeValue, float64(cnt), phase, tpe, class)
		if err != nil {
			log.WithError(err).Warnf("cannot create workspace metric - %s will be inaccurate", m.name)
			continue
		}

		ch <- metric
	}
}

// workspaceActivityVec provides a gauge of the currently active/inactive workspaces.
// Adding both up returns the total number of workspaces.
type workspaceActivityVec struct {
	*prometheus.GaugeVec
	name    string
	manager *Manager
}

func newWorkspaceActivityVec(m *Manager) *workspaceActivityVec {
	opts := prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsWorkspaceSubsystem,
		Name:      "workspace_activity_total",
	}
	return &workspaceActivityVec{
		GaugeVec: prometheus.NewGaugeVec(opts, []string{"active"}),
		name:     prometheus.BuildFQName(opts.Namespace, opts.Subsystem, opts.Name),
		manager:  m,
	}
}

// Collect implements Collector.
func (vec *workspaceActivityVec) Collect(ch chan<- prometheus.Metric) {
	active, notActive, err := vec.getWorkspaceActivityCounts()
	if err != nil {
		log.WithError(err).Errorf("cannot determine active/inactive counts - %s will be inaccurate", vec.name)
		return
	}

	activeGauge, err := vec.GetMetricWithLabelValues("true")
	if err != nil {
		log.WithError(err).Error("cannot get active gauge count - this is an internal configuration error and should not happen")
		return
	}
	notActiveGauge, err := vec.GetMetricWithLabelValues("false")
	if err != nil {
		log.WithError(err).Error("cannot get not-active gauge count - this is an internal configuration error and should not happen")
		return
	}

	activeGauge.Set(float64(active))
	notActiveGauge.Set(float64(notActive))
	vec.GaugeVec.Collect(ch)
}

func (vec *workspaceActivityVec) getWorkspaceActivityCounts() (active, notActive int, err error) {
	wso, err := vec.manager.getAllWorkspaceObjects(context.Background())
	if err != nil {
		return
	}

	for _, w := range wso {
		id, ok := w.WorkspaceID()
		if !ok {
			continue
		}

		tpe, err := w.WorkspaceType()
		if err != nil || tpe != api.WorkspaceType_REGULAR {
			continue
		}

		hasActivity := vec.manager.getWorkspaceActivity(id) != nil
		if hasActivity {
			active++
		} else {
			notActive++
		}
	}
	return
}

// timeoutSettingsVec provides a gauge of the currently active/inactive workspaces.
// Adding both up returns the total number of workspaces.
type timeoutSettingsVec struct {
	name    string
	manager *Manager
	desc    *prometheus.Desc
}

func newTimeoutSettingsVec(m *Manager) *timeoutSettingsVec {
	name := prometheus.BuildFQName("wsman", "workspace", "timeout_settings_total")
	desc := prometheus.NewDesc(
		name,
		"Current number of workspaces per timeout setting",
		[]string{"timeout"},
		prometheus.Labels(map[string]string{}),
	)
	return &timeoutSettingsVec{
		name:    name,
		manager: m,
		desc:    desc,
	}
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (vec *timeoutSettingsVec) Describe(ch chan<- *prometheus.Desc) {
	ch <- vec.desc
}

// Collect implements Collector.
func (vec *timeoutSettingsVec) Collect(ch chan<- prometheus.Metric) {
	wso, err := vec.manager.getAllWorkspaceObjects(context.Background())
	if err != nil {
		log.WithError(err).Errorf("cannot collect workspace objects - %s will be inaccurate", vec.name)
		return
	}

	hist := make(map[string]int)
	for _, obj := range wso {
		if obj.Pod == nil {
			continue
		}
		timeout, ok := obj.Pod.Annotations[customTimeoutAnnotation]
		if !ok {
			continue
		}

		hist[timeout]++
	}

	for phase, cnt := range hist {
		// metrics cannot be re-used, we have to create them every single time
		metric, err := prometheus.NewConstMetric(vec.desc, prometheus.GaugeValue, float64(cnt), phase)
		if err != nil {
			log.WithError(err).Warnf("cannot create workspace metric - %s will be inaccurate", vec.name)
			continue
		}

		ch <- metric
	}
}

// subscriberQueueLevelVec provides a gauge of the current subscriber queue fill levels.
type subscriberQueueLevelVec struct {
	name    string
	manager *Manager
	desc    *prometheus.Desc
}

func newSubscriberQueueLevelVec(m *Manager) *subscriberQueueLevelVec {
	name := prometheus.BuildFQName(metricsNamespace, metricsWorkspaceSubsystem, "subscriber_queue_level")
	desc := prometheus.NewDesc(
		name,
		"Current fill levels of the subscriber queues",
		[]string{"client"},
		prometheus.Labels(map[string]string{}),
	)
	return &subscriberQueueLevelVec{
		name:    name,
		manager: m,
		desc:    desc,
	}
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (vec *subscriberQueueLevelVec) Describe(ch chan<- *prometheus.Desc) {
	ch <- vec.desc
}

// Collect implements Collector.
func (vec *subscriberQueueLevelVec) Collect(ch chan<- prometheus.Metric) {
	vec.manager.subscriberLock.RLock()
	defer vec.manager.subscriberLock.RUnlock()

	for key, queue := range vec.manager.subscribers {
		// metrics cannot be re-used, we have to create them every single time
		metric, err := prometheus.NewConstMetric(vec.desc, prometheus.GaugeValue, float64(len(queue)), key)
		if err != nil {
			log.WithError(err).Warnf("cannot create workspace metric - %s will be inaccurate", vec.name)
			continue
		}

		ch <- metric
	}
}
