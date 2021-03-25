// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	corev1 "k8s.io/api/core/v1"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// RegisterMetrics registers the Prometheus metrics of this manager
func (m *Manager) RegisterMetrics(reg prometheus.Registerer) error {
	return m.metrics.Register(reg)
}

const (
	metricsNamespace          = "gitpod_ws_manager"
	metricsWorkspaceSubsystem = "workspace"
)

type metrics struct {
	manager *Manager

	startupTimeHistVec    *prometheus.HistogramVec
	totalStartsCounterVec *prometheus.CounterVec
	totalStopsCounterVec  *prometheus.CounterVec

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
			Name:      "startup_seconds",
			Help:      "time it took for workspace pods to reach the running phase",
			// same as components/ws-manager-bridge/src/prometheus-metrics-exporter.ts#L15
			Buckets: prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type"}),
		totalStartsCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "starts_total",
			Help:      "total number of workspaces started",
		}, []string{"type"}),
		totalStopsCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "stops_total",
			Help:      "total number of workspaces stopped",
		}, []string{"reason"}),
	}
}

// Register registers all metrics ws-manager can export
func (m *metrics) Register(reg prometheus.Registerer) error {
	collectors := []prometheus.Collector{
		m.startupTimeHistVec,
		newPhaseTotalVec(m.manager),
		newWorkspaceActivityVec(m.manager),
		newTimeoutSettingsVec(m.manager),
		newSubscriberQueueLevelVec(m.manager),
		m.totalStartsCounterVec,
		m.totalStopsCounterVec,
	}
	for _, c := range collectors {
		err := reg.Register(c)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *metrics) OnWorkspaceStarted(tpe api.WorkspaceType) {
	nme := api.WorkspaceType_name[int32(tpe)]
	counter, err := m.totalStartsCounterVec.GetMetricWithLabelValues(nme)
	if err != nil {
		log.WithError(err).WithField("type", tpe).Warn("cannot get counter for workspace start metric")
		return
	}

	counter.Inc()
}

func (m *metrics) OnChange(status *api.WorkspaceStatus) {
	var removeFromState bool
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
		tpe := api.WorkspaceType_name[int32(status.Spec.Type)]
		hist, err := m.startupTimeHistVec.GetMetricWithLabelValues(tpe)
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
		} else if status.Conditions.Failed != "" {
			reason = "failed"
		} else {
			reason = "regular-stop"
		}

		counter, err := m.totalStopsCounterVec.GetMetricWithLabelValues(reason)
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
	name := prometheus.BuildFQName(metricsNamespace, metricsWorkspaceSubsystem, "phase_total")
	return &phaseTotalVec{
		name:    name,
		desc:    prometheus.NewDesc(name, "Current number of workspaces per phase", []string{"phase", "type"}, prometheus.Labels(map[string]string{})),
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

		counts[tpe+"::"+status]++
	}

	for key, cnt := range counts {
		segs := strings.Split(key, "::")
		tpe, phase := segs[0], segs[1]

		// metrics cannot be re-used, we have to create them every single time
		metric, err := prometheus.NewConstMetric(m.desc, prometheus.GaugeValue, float64(cnt), phase, tpe)
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
		Name:      "activity_total",
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
