// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	"github.com/gitpod-io/gitpod/ws-manager-mk2/clock"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/go-logr/logr"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace          = "gitpod"
	metricsWorkspaceSubsystem = "ws_manager"
	// kubernetesOperationTimeout is the time we give Kubernetes operations in general.
	kubernetesOperationTimeout = 5 * time.Second
)

func NewWorkspaceReconciler(c client.Client, scheme *runtime.Scheme, cfg config.Configuration, reg prometheus.Registerer) (*WorkspaceReconciler, error) {
	reconciler := &WorkspaceReconciler{
		Client: c,
		Scheme: scheme,
		Config: cfg,
		clock:  clock.System(),
	}

	metrics := newControllerMetrics(reconciler)
	reg.Register(metrics)
	reconciler.metrics = metrics

	return reconciler, nil
}

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme

	Config      config.Configuration
	clock       *clock.HLC
	metrics     *controllerMetrics
	OnReconcile func(ctx context.Context, ws *workspacev1.Workspace)
}

//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/finalizers,verbs=update
//+kubebuilder:rbac:groups=core,resources=pod,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=core,resources=pod/status,verbs=get

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
// the Workspace object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.11.0/pkg/reconcile
func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	if err := r.Get(ctx, req.NamespacedName, &workspace); err != nil {
		// TODO(cw): create pdo
		log.Error(err, "unable to fetch workspace")
		// we'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if workspace.Status.Conditions == nil {
		workspace.Status.Conditions = []metav1.Condition{}
	}

	log.Info("reconciling workspace", "ws", req.NamespacedName)

	var workspacePods corev1.PodList
	err := r.List(ctx, &workspacePods, client.InNamespace(req.Namespace), client.MatchingFields{wsOwnerKey: req.Name})
	if err != nil {
		log.Error(err, "unable to list workspace pods")
		return ctrl.Result{}, err
	}

	err = updateWorkspaceStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return ctrl.Result{}, err
	}

	err = r.updateMetrics(ctx, &workspace)
	if err != nil {
		log.Error(err, "could not update metrics")
	}

	result, err := r.actOnStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return result, err
	}

	err = r.Status().Update(ctx, &workspace)
	if err != nil {
		// log.WithValues("status", workspace).Error(err, "unable to update workspace status")
		return ctrl.Result{Requeue: true}, err
	}

	if r.OnReconcile != nil {
		r.OnReconcile(ctx, &workspace)
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) actOnStatus(ctx context.Context, workspace *workspacev1.Workspace, workspacePods corev1.PodList) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	// if there isn't a workspace pod and we're not currently deleting this workspace,
	// create one.
	if len(workspacePods.Items) == 0 && workspace.Status.PodStarts == 0 {
		sctx, err := newStartWorkspaceContext(ctx, &r.Config, workspace)
		if err != nil {
			log.Error(err, "unable to create startWorkspace context")
			return ctrl.Result{Requeue: true}, err
		}

		pod, err := r.createWorkspacePod(sctx)
		if err != nil {
			log.Error(err, "unable to produce workspace pod")
			return ctrl.Result{}, err
		}

		if err := ctrl.SetControllerReference(workspace, pod, r.Scheme); err != nil {
			return ctrl.Result{}, err
		}

		err = r.Create(ctx, pod)
		if errors.IsAlreadyExists(err) {
			// pod exists, we're good
		} else if err != nil {
			log.Error(err, "unable to create Pod for Workspace", "pod", pod)
			return ctrl.Result{Requeue: true}, err
		} else {
			// TODO(cw): replicate the startup mechanism where pods can fail to be scheduled,
			//			 need to be deleted and re-created
			workspace.Status.PodStarts++
		}

		return ctrl.Result{}, nil
	}

	// all actions below assume there is a pod
	if len(workspacePods.Items) == 0 {
		return ctrl.Result{}, nil
	}
	pod := &workspacePods.Items[0]

	switch {
	// if there is a pod, and it's failed, delete it
	case conditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)) && !isPodBeingDeleted(pod):
		err := r.Client.Delete(ctx, pod)
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, err
		}

	// if the pod was stopped by request, delete it
	case conditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionStoppedByRequest)) && !isPodBeingDeleted(pod):
		err := r.Client.Delete(ctx, pod)
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, err
		}

	// we've disposed already - try to remove the finalizer and call it a day
	case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
		var foundFinalizer bool
		n := 0
		for _, x := range pod.Finalizers {
			if x != gitpodPodFinalizerName {
				pod.Finalizers[n] = x
				n++
			} else {
				foundFinalizer = true
			}
		}
		pod.Finalizers = pod.Finalizers[:n]
		err := r.Client.Update(ctx, pod)
		if err != nil {
			return ctrl.Result{Requeue: true}, err
		}

		if foundFinalizer {
			// reque to remove workspace
			return ctrl.Result{RequeueAfter: 10 * time.Second}, nil
		}

		err = r.Client.Delete(ctx, workspace)
		if err != nil {
			return ctrl.Result{Requeue: true}, err
		}
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) updateMetrics(ctx context.Context, workspace *workspacev1.Workspace) error {
	log := log.FromContext(ctx)

	phase := workspace.Status.Phase

	switch {
	case phase == workspacev1.WorkspacePhasePending ||
		phase == workspacev1.WorkspacePhaseCreating ||
		phase == workspacev1.WorkspacePhaseInitializing:

		if conditionWithStatusAndReson(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, "") {
			r.metrics.countTotalRestoreFailures(&log, workspace)
		}

		if conditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)) {
			r.metrics.countWorkspaceStartupFailure(&log, workspace)
		}

	case phase == workspacev1.WorkspacePhaseRunning:
		r.metrics.recordWorkspaceStartupTime(&log, workspace)
		if conditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)) {
			r.metrics.countTotalRestores(&log, workspace)
		}

	case phase == workspacev1.WorkspacePhaseStopped:
		if conditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionBackupFailure)) {
			r.metrics.countTotalBackupFailures(&log, workspace)
		}

		if conditionPresentAndTrue(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionBackupComplete)) {
			r.metrics.countTotalBackups(&log, workspace)
		}

		r.metrics.countWorkspaceStop(&log, workspace)
	}

	return nil
}
func (r *WorkspaceReconciler) RegisterMetrics(reg prometheus.Registerer) error {
	return reg.Register(r.metrics)
}

func (r *WorkspaceReconciler) GetWorkspaces(context.Context) workspacev1.WorkspaceList {
	return workspacev1.WorkspaceList{}
}

func conditionPresentAndTrue(cond []metav1.Condition, tpe string) bool {
	for _, c := range cond {
		if c.Type == tpe {
			return c.Status == metav1.ConditionTrue
		}
	}
	return false
}

// func conditionPresentAndFalse(cond []metav1.Condition, tpe string) bool {
// 	for _, c := range cond {
// 		if c.Type == tpe {
// 			return c.Status == metav1.ConditionFalse
// 		}
// 	}
// 	return false
// }

func conditionWithStatusAndReson(cond []metav1.Condition, tpe string, status bool, reason string) bool {
	for _, c := range cond {
		if c.Type == tpe {
			return c.Type == tpe && c.Reason == reason
		}
	}
	return false
}

var (
	wsOwnerKey = ".metadata.controller"
	apiGVStr   = workspacev1.GroupVersion.String()
)

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	idx := func(rawObj client.Object) []string {
		// grab the job object, extract the owner...
		job := rawObj.(*corev1.Pod)
		owner := metav1.GetControllerOf(job)
		if owner == nil {
			return nil
		}
		// ...make sure it's a workspace...
		if owner.APIVersion != apiGVStr || owner.Kind != "Workspace" {
			return nil
		}

		// ...and if so, return it
		return []string{owner.Name}
	}
	err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Pod{}, wsOwnerKey, idx)
	if err != nil {
		return err
	}

	return ctrl.NewControllerManagedBy(mgr).
		For(&workspacev1.Workspace{}).
		Owns(&corev1.Pod{}).
		Complete(r)
}

func AddUniqueCondition(conds []metav1.Condition, cond metav1.Condition) []metav1.Condition {
	if cond.Reason == "" {
		cond.Reason = "unknown"
	}

	for i, c := range conds {
		if c.Type == cond.Type {
			conds[i] = cond
			return conds
		}
	}

	return append(conds, cond)
}

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
}

func newControllerMetrics(r *WorkspaceReconciler) *controllerMetrics {
	return &controllerMetrics{
		startupTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsWorkspaceSubsystem,
			Name:      "workspace_startup_seconds",
			Help:      "time it took for workspace pods to reach the running phase",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
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

		workspacePhases: newPhaseTotalVec(r),
		timeoutSettings: newTimeoutSettingsVec(r),
	}
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

func (m *controllerMetrics) countWorkspaceStartupFailure(log *logr.Logger, ws *workspacev1.Workspace) {
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

	counter, err := m.totalStopsCounterVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.Error(err, "could not count workspace stop", "type", tpe, "class", class)
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
		log.Error(err, "could not record workspace restore failure", "type", tpe, "class", class)
	}

	counter.Inc()
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
