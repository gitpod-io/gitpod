// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"fmt"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	glog "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"

	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
)

var retryParams = wait.Backoff{
	Steps:    10,
	Duration: 10 * time.Millisecond,
	Factor:   2.0,
	Jitter:   0.2,
}

type WorkspaceControllerOpts struct {
	NodeName         string
	ContentConfig    content.Config
	UIDMapperConfig  iws.UidmapperConfig
	ContainerRuntime container.Runtime
	CGroupMountPoint string
	MetricsRegistry  prometheus.Registerer
}

type WorkspaceController struct {
	client.Client
	NodeName   string
	opts       *WorkspaceControllerOpts
	operations WorkspaceOperations
	metrics    *workspaceMetrics
}

func NewWorkspaceController(c client.Client, opts WorkspaceControllerOpts) (*WorkspaceController, error) {
	xfs, err := quota.NewXFS(opts.ContentConfig.WorkingArea)
	if err != nil {
		return nil, err
	}
	store, err := session.NewStore(context.Background(), opts.ContentConfig.WorkingArea, content.WorkspaceLifecycleHooks(
		opts.ContentConfig,
		func(instanceID string) bool { return true },
		&iws.Uidmapper{Config: opts.UIDMapperConfig, Runtime: opts.ContainerRuntime},
		xfs,
		opts.CGroupMountPoint,
	))
	if err != nil {
		return nil, err
	}

	metrics := newWorkspaceMetrics()
	opts.MetricsRegistry.Register(metrics)

	ops, err := NewWorkspaceOperations(opts.ContentConfig, store, opts.MetricsRegistry)
	if err != nil {
		return nil, err
	}

	return &WorkspaceController{
		Client:     c,
		NodeName:   opts.NodeName,
		opts:       &opts,
		operations: *ops,
		metrics:    metrics,
	}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (wsc *WorkspaceController) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		Named("workspace").
		For(&workspacev1.Workspace{}).
		WithEventFilter(eventFilter(wsc.NodeName)).
		Complete(wsc)
}

func eventFilter(nodeName string) predicate.Predicate {
	return predicate.Funcs{
		CreateFunc: func(e event.CreateEvent) bool {
			return workspaceFilter(e.Object, nodeName)
		},

		UpdateFunc: func(e event.UpdateEvent) bool {
			return workspaceFilter(e.ObjectNew, nodeName)
		},
		DeleteFunc: func(e event.DeleteEvent) bool {
			return false
		},
	}
}

func workspaceFilter(object client.Object, nodeName string) bool {
	if ws, ok := object.(*workspacev1.Workspace); ok {
		return ws.Status.Runtime != nil && ws.Status.Runtime.NodeName == nodeName
	}
	return false
}

func (wsc *WorkspaceController) Reconcile(ctx context.Context, req ctrl.Request) (result ctrl.Result, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "Reconcile")
	defer tracing.FinishSpan(span, &err)

	var workspace workspacev1.Workspace
	if err := wsc.Get(ctx, req.NamespacedName, &workspace); err != nil {
		// ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification).
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	glog.WithField("workspaceID", workspace.Name).WithField("phase", workspace.Status.Phase).Debug("Reconcile workspace")

	if workspace.Status.Phase == workspacev1.WorkspacePhaseCreating ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseInitializing ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseRunning {

		result, err = wsc.handleWorkspaceInit(ctx, &workspace, req)
		return result, err
	}

	if workspace.Status.Phase == workspacev1.WorkspacePhaseStopping {
		result, err = wsc.handleWorkspaceStop(ctx, &workspace, req)
		return result, err
	}

	return ctrl.Result{}, nil
}

func (wsc *WorkspaceController) handleWorkspaceInit(ctx context.Context, ws *workspacev1.Workspace, req ctrl.Request) (result ctrl.Result, err error) {
	log := log.FromContext(ctx)
	span, ctx := opentracing.StartSpanFromContext(ctx, "handleWorkspaceInit")
	defer tracing.FinishSpan(span, &err)

	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c == nil {
		var init csapi.WorkspaceInitializer
		err = proto.Unmarshal(ws.Spec.Initializer, &init)
		if err != nil {
			err = fmt.Errorf("cannot unmarshal initializer config: %w", err)
			return ctrl.Result{}, err
		}

		initStart := time.Now()
		alreadyInit, failure, initErr := wsc.operations.InitWorkspaceContent(ctx, InitContentOptions{
			Meta: WorkspaceMeta{
				Owner:       ws.Spec.Ownership.Owner,
				WorkspaceId: ws.Spec.Ownership.WorkspaceID,
				InstanceId:  ws.Name,
			},
			Initializer: &init,
			Headless:    ws.Status.Headless,
		})

		if alreadyInit {
			return ctrl.Result{}, nil
		}

		err = retry.RetryOnConflict(retryParams, func() error {
			if err := wsc.Get(ctx, req.NamespacedName, ws); err != nil {
				return err
			}

			if failure != "" {
				log.Error(initErr, "could not initialize workspace", "name", ws.Name)
				ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionContentReady),
					Status:             metav1.ConditionFalse,
					Message:            failure,
					Reason:             "InitializationFailure",
					LastTransitionTime: metav1.Now(),
				})
			} else {
				ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionContentReady),
					Status:             metav1.ConditionTrue,
					Reason:             "InitializationSuccess",
					LastTransitionTime: metav1.Now(),
				})
			}

			return wsc.Status().Update(ctx, ws)
		})

		if err == nil {
			wsc.metrics.recordInitializeTime(time.Since(initStart).Seconds(), ws)
		}

		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

func (wsc *WorkspaceController) handleWorkspaceStop(ctx context.Context, ws *workspacev1.Workspace, req ctrl.Request) (result ctrl.Result, err error) {
	log := log.FromContext(ctx)
	span, ctx := opentracing.StartSpanFromContext(ctx, "handleWorkspaceStop")
	defer tracing.FinishSpan(span, &err)

	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c == nil || c.Status == metav1.ConditionFalse {
		return ctrl.Result{}, fmt.Errorf("workspace content was never ready")
	}

	if wsk8s.ConditionPresentAndTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionBackupComplete)) {
		return ctrl.Result{}, nil
	}

	if wsk8s.ConditionPresentAndTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionBackupFailure)) {
		return ctrl.Result{}, nil
	}

	if wsk8s.ConditionPresentAndTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionAborted)) {
		span.LogKV("event", "workspace was aborted")
		return ctrl.Result{}, nil
	}

	disposeStart := time.Now()
	alreadyDisposing, gitStatus, disposeErr := wsc.operations.DisposeWorkspace(ctx, DisposeOptions{
		Meta: WorkspaceMeta{
			Owner:       ws.Spec.Ownership.Owner,
			WorkspaceId: ws.Spec.Ownership.WorkspaceID,
			InstanceId:  ws.Name,
		},
		WorkspaceLocation: ws.Spec.WorkspaceLocation,
		BackupLogs:        ws.Spec.Type == workspacev1.WorkspaceTypePrebuild,
	})

	if alreadyDisposing {
		return ctrl.Result{}, nil
	}

	err = retry.RetryOnConflict(retryParams, func() error {
		if err := wsc.Get(ctx, req.NamespacedName, ws); err != nil {
			return err
		}

		ws.Status.GitStatus = toWorkspaceGitStatus(gitStatus)

		if disposeErr != nil {
			log.Error(disposeErr, "failed to dispose workspace", "name", ws.Name)
			ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
				Type:               string(workspacev1.WorkspaceConditionBackupFailure),
				Status:             metav1.ConditionTrue,
				Reason:             "BackupFailed",
				Message:            disposeErr.Error(),
				LastTransitionTime: metav1.Now(),
			})
		} else {
			ws.Status.Conditions = wsk8s.AddUniqueCondition(ws.Status.Conditions, metav1.Condition{
				Type:               string(workspacev1.WorkspaceConditionBackupComplete),
				Status:             metav1.ConditionTrue,
				Reason:             "BackupComplete",
				LastTransitionTime: metav1.Now(),
			})
		}

		return wsc.Status().Update(ctx, ws)
	})

	if err == nil {
		wsc.metrics.recordFinalizeTime(time.Since(disposeStart).Seconds(), ws)
	}

	return ctrl.Result{}, err
}

func toWorkspaceGitStatus(status *csapi.GitStatus) *workspacev1.GitStatus {
	if status == nil {
		return nil
	}

	return &workspacev1.GitStatus{
		Branch:               status.Branch,
		LatestCommit:         status.LatestCommit,
		UncommitedFiles:      status.UncommitedFiles,
		TotalUncommitedFiles: status.TotalUncommitedFiles,
		UntrackedFiles:       status.UntrackedFiles,
		TotalUntrackedFiles:  status.TotalUntrackedFiles,
		UnpushedCommits:      status.UnpushedCommits,
		TotalUnpushedCommits: status.TotalUnpushedCommits,
	}
}

type workspaceMetrics struct {
	initializeTimeHistVec *prometheus.HistogramVec
	finalizeTimeHistVec   *prometheus.HistogramVec
}

func newWorkspaceMetrics() *workspaceMetrics {
	return &workspaceMetrics{
		initializeTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "gitpod",
			Subsystem: "ws_daemon",
			Name:      "workspace_initialize_seconds",
			Help:      "time it took to initialize workspace",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
		finalizeTimeHistVec: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "gitpod",
			Subsystem: "ws_daemon",
			Name:      "workspace_finalize_seconds",
			Help:      "time it took to finalize workspace",
			Buckets:   prometheus.ExponentialBuckets(2, 2, 10),
		}, []string{"type", "class"}),
	}
}

func (m *workspaceMetrics) recordInitializeTime(duration float64, ws *workspacev1.Workspace) {
	tpe := string(ws.Spec.Type)
	class := ws.Spec.Class

	hist, err := m.initializeTimeHistVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		glog.WithError(err).WithField("type", tpe).WithField("class", class).Infof("could not retrieve initialize metric")
	}

	hist.Observe(duration)
}

func (m *workspaceMetrics) recordFinalizeTime(duration float64, ws *workspacev1.Workspace) {
	tpe := string(ws.Spec.Type)
	class := ws.Spec.Class

	hist, err := m.finalizeTimeHistVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		glog.WithError(err).WithField("type", tpe).WithField("class", class).Infof("could not retrieve finalize metric")
	}

	hist.Observe(duration)
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (m *workspaceMetrics) Describe(ch chan<- *prometheus.Desc) {
	m.initializeTimeHistVec.Describe(ch)
	m.finalizeTimeHistVec.Describe(ch)
}

// Collect implements Collector.
func (m *workspaceMetrics) Collect(ch chan<- prometheus.Metric) {
	m.initializeTimeHistVec.Collect(ch)
	m.finalizeTimeHistVec.Collect(ch)
}
