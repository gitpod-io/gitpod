// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/workqueue"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/predicate"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/components/scrubber"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/constants"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/maintenance"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	metricsNamespace          = "gitpod"
	metricsWorkspaceSubsystem = "ws_manager_mk2"
	// kubernetesOperationTimeout is the time we give Kubernetes operations in general.
	kubernetesOperationTimeout = 5 * time.Second
	maintenanceRequeue         = 1 * time.Minute
)

func NewWorkspaceReconciler(c client.Client, scheme *runtime.Scheme, recorder record.EventRecorder, cfg *config.Configuration, reg prometheus.Registerer, maintenance maintenance.Maintenance) (*WorkspaceReconciler, error) {
	reconciler := &WorkspaceReconciler{
		Client:      c,
		Scheme:      scheme,
		Config:      cfg,
		maintenance: maintenance,
		Recorder:    recorder,
	}

	metrics, err := newControllerMetrics(reconciler)
	if err != nil {
		return nil, err
	}
	reg.MustRegister(metrics)
	reconciler.metrics = metrics

	return reconciler, nil
}

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme

	Config      *config.Configuration
	metrics     *controllerMetrics
	maintenance maintenance.Maintenance
	Recorder    record.EventRecorder
}

//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/finalizers,verbs=update
//+kubebuilder:rbac:groups=core,resources=pod,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=core,resources=pod/status,verbs=get

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// Modify the Reconcile function to compare the state specified by
// the Workspace object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.11.0/pkg/reconcile
func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (result ctrl.Result, err error) {
	span, ctx := tracing.FromContext(ctx, "WorkspaceReconciler.Reconcile")
	defer tracing.FinishSpan(span, &err)

	var workspace workspacev1.Workspace
	err = r.Get(ctx, req.NamespacedName, &workspace)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			log.Error(err, "unable to fetch workspace")
		}
		// we'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if workspace.Status.Conditions == nil {
		workspace.Status.Conditions = []metav1.Condition{}
	}

	owi := log.OWI(workspace.Spec.Ownership.Owner, workspace.Spec.Ownership.WorkspaceID, workspace.Name)
	log.WithFields(owi).WithField("phase", workspace.Status.Phase).Info("reconciling workspace")

	workspacePods, err := r.listWorkspacePods(ctx, &workspace)
	if err != nil {
		log.WithFields(owi).WithError(err).Error("unable to list workspace pods")
		return ctrl.Result{}, fmt.Errorf("failed to list workspace pods: %w", err)
	}

	oldStatus := workspace.Status.DeepCopy()
	err = r.updateWorkspaceStatus(ctx, &workspace, workspacePods, r.Config)
	if err != nil {
		return ctrl.Result{}, fmt.Errorf("failed to compute latest workspace status: %w", err)
	}

	r.updateMetrics(ctx, &workspace)
	r.emitPhaseEvents(ctx, &workspace, oldStatus)

	var podStatus *corev1.PodStatus
	if len(workspacePods.Items) > 0 {
		podStatus = &workspacePods.Items[0].Status
	}

	if !equality.Semantic.DeepDerivative(oldStatus, workspace.Status) {
		log.WithFields(owi).
			// allow the top level object, and rely on its annotations to redact at the field level
			WithField("workspaceStatus", &log.TrustedValueWrap{Value: scrubber.Default.DeepCopyStruct(workspace.Status)}).
			// we don't own the corev1.PodStatus type, so we trust the whole thing
			WithField("podStatus", &log.TrustedValueWrap{Value: podStatus}).
			Info("updating workspace status")
	}

	err = r.Status().Update(ctx, &workspace)
	if err != nil {
		return errorResultLogConflict(fmt.Errorf("failed to update workspace status: %w", err))
	}

	result, err = r.actOnStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return errorResultLogConflict(fmt.Errorf("failed to act on status: %w", err))
	}

	return result, nil
}

func (r *WorkspaceReconciler) listWorkspacePods(ctx context.Context, ws *workspacev1.Workspace) (list *corev1.PodList, err error) {
	span, ctx := tracing.FromContext(ctx, "listWorkspacePods")
	defer tracing.FinishSpan(span, &err)

	var workspacePods corev1.PodList
	err = r.List(ctx, &workspacePods, client.InNamespace(ws.Namespace), client.MatchingFields{wsOwnerKey: ws.Name})
	if err != nil {
		return nil, err
	}

	return &workspacePods, nil
}

func (r *WorkspaceReconciler) actOnStatus(ctx context.Context, workspace *workspacev1.Workspace, workspacePods *corev1.PodList) (result ctrl.Result, err error) {
	span, ctx := tracing.FromContext(ctx, "actOnStatus")
	owi := log.OWI(workspace.Spec.Ownership.Owner, workspace.Spec.Ownership.WorkspaceID, workspace.Name)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	if workspace.Status.Phase != workspacev1.WorkspacePhaseStopped && !r.metrics.containsWorkspace(workspace) {
		// If the workspace hasn't stopped yet, and we don't know about this workspace yet, remember it.
		r.metrics.rememberWorkspace(workspace, nil)
	}

	if len(workspacePods.Items) == 0 {
		// if there isn't a workspace pod and we're not currently deleting this workspace,// create one.
		switch {
		case workspace.Status.PodStarts == 0:
			sctx, err := newStartWorkspaceContext(ctx, r.Config, workspace)
			if err != nil {
				log.WithFields(owi).WithError(err).Error("unable to create startWorkspace context")
				return ctrl.Result{Requeue: true}, err
			}

			pod, err := r.createWorkspacePod(sctx)
			if err != nil {
				log.WithFields(owi).WithError(err).Error("unable to produce workspace pod")
				return ctrl.Result{}, err
			}

			if err := ctrl.SetControllerReference(workspace, pod, r.Scheme); err != nil {
				return ctrl.Result{}, err
			}

			err = r.Create(ctx, pod)
			if apierrors.IsAlreadyExists(err) {
				// pod exists, we're good
			} else if err != nil {
				log.WithFields(owi).WithField("pod", pod).WithError(err).Error("unable to create Pod for Workspace")
				return ctrl.Result{Requeue: true}, err
			} else {
				// TODO(cw): replicate the startup mechanism where pods can fail to be scheduled,
				//			 need to be deleted and re-created
				// Must increment and persist the pod starts, and ensure we retry on conflict.
				// If we fail to persist this value, it's possible that the Pod gets recreated
				// when the workspace stops, due to PodStarts still being 0 when the original Pod
				// disappears.
				// Use a Patch instead of an Update, to prevent conflicts.
				patch := client.MergeFrom(workspace.DeepCopy())
				workspace.Status.PodStarts++
				if err := r.Status().Patch(ctx, workspace, patch); err != nil {
					log.WithFields(owi).WithError(err).Error("Failed to patch PodStarts in workspace status")
					return ctrl.Result{}, err
				}

				r.Recorder.Event(workspace, corev1.EventTypeNormal, "Creating", "")
			}

		case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
			if err := r.deleteWorkspaceSecrets(ctx, workspace); err != nil {
				return ctrl.Result{}, err
			}

			// Done stopping workspace - remove finalizer.
			if controllerutil.ContainsFinalizer(workspace, workspacev1.GitpodFinalizerName) {
				controllerutil.RemoveFinalizer(workspace, workspacev1.GitpodFinalizerName)
				if err := r.Update(ctx, workspace); err != nil {
					if apierrors.IsNotFound(err) {
						return ctrl.Result{}, nil
					} else {
						return ctrl.Result{}, fmt.Errorf("failed to remove gitpod finalizer from workspace: %w", err)
					}
				}
			}

			// Workspace might have already been in a deleting state,
			// but not guaranteed, so try deleting anyway.
			r.Recorder.Event(workspace, corev1.EventTypeNormal, "Deleting", "")
			err := r.Client.Delete(ctx, workspace)
			return ctrl.Result{}, client.IgnoreNotFound(err)
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
	case workspace.IsConditionTrue(workspacev1.WorkspaceConditionFailed) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "workspace failed")

	// if the pod was stopped by request, delete it
	case workspace.IsConditionTrue(workspacev1.WorkspaceConditionStoppedByRequest) && !isPodBeingDeleted(pod):
		var gracePeriodSeconds *int64
		if c := wsk8s.GetCondition(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionStoppedByRequest)); c != nil {
			if dt, err := time.ParseDuration(c.Message); err == nil {
				s := int64(dt.Seconds())
				gracePeriodSeconds = &s
			}
		}
		err := r.Client.Delete(ctx, pod, &client.DeleteOptions{
			GracePeriodSeconds: gracePeriodSeconds,
		})
		if apierrors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, err
		}

	// if the node disappeared, delete the pod.
	case workspace.IsConditionTrue(workspacev1.WorkspaceConditionNodeDisappeared) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "node disappeared")

	// if the workspace timed out, delete it
	case workspace.IsConditionTrue(workspacev1.WorkspaceConditionTimeout) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "timed out")

	// if the content initialization failed, delete the pod
	case wsk8s.ConditionWithStatusAndReason(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, workspacev1.ReasonInitializationFailure) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "init failed")

	case isWorkspaceBeingDeleted(workspace) && !isPodBeingDeleted(pod):
		return r.deleteWorkspacePod(ctx, pod, "workspace deleted")

	case workspace.IsHeadless() && workspace.Status.Phase == workspacev1.WorkspacePhaseStopped && !isPodBeingDeleted(pod):
		// Workspace was requested to be deleted, propagate by deleting the Pod.
		// The Pod deletion will then trigger workspace disposal steps.
		err := r.Client.Delete(ctx, pod)
		if apierrors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, err
		}

	case workspace.Status.Phase == workspacev1.WorkspacePhaseRunning:
		err := r.deleteWorkspaceSecrets(ctx, workspace)
		if err != nil {
			log.WithFields(owi).WithError(err).Error("could not delete workspace secrets")
		}

	// we've disposed already - try to remove the finalizer and call it a day
	case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
		hadFinalizer := controllerutil.ContainsFinalizer(pod, workspacev1.GitpodFinalizerName)
		controllerutil.RemoveFinalizer(pod, workspacev1.GitpodFinalizerName)
		if err := r.Client.Update(ctx, pod); err != nil {
			return ctrl.Result{}, fmt.Errorf("failed to remove gitpod finalizer from pod: %w", err)
		}

		if hadFinalizer {
			// Requeue to remove workspace.
			return ctrl.Result{RequeueAfter: 10 * time.Second}, nil
		}
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) updateMetrics(ctx context.Context, workspace *workspacev1.Workspace) {
	ok, lastState := r.metrics.getWorkspace(workspace)
	if !ok {
		return
	}

	if !lastState.recordedInitFailure && wsk8s.ConditionWithStatusAndReason(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady), false, workspacev1.ReasonInitializationFailure) {
		r.metrics.countTotalRestoreFailures(workspace)
		lastState.recordedInitFailure = true
	}

	if !lastState.recordedFailure && workspace.IsConditionTrue(workspacev1.WorkspaceConditionFailed) {
		r.metrics.countWorkspaceFailure(workspace)
		lastState.recordedFailure = true
	}

	if lastState.pendingStartTime.IsZero() && workspace.Status.Phase == workspacev1.WorkspacePhasePending {
		lastState.pendingStartTime = time.Now()
	} else if !lastState.pendingStartTime.IsZero() && workspace.Status.Phase != workspacev1.WorkspacePhasePending {
		r.metrics.recordWorkspacePendingTime(workspace, lastState.pendingStartTime)
		lastState.pendingStartTime = time.Time{}
	}

	if lastState.creatingStartTime.IsZero() && workspace.Status.Phase == workspacev1.WorkspacePhaseCreating {
		lastState.creatingStartTime = time.Now()
	} else if !lastState.creatingStartTime.IsZero() && workspace.Status.Phase != workspacev1.WorkspacePhaseCreating {
		r.metrics.recordWorkspaceCreatingTime(workspace, lastState.creatingStartTime)
		lastState.creatingStartTime = time.Time{}
	}

	if !lastState.recordedContentReady && workspace.IsConditionTrue(workspacev1.WorkspaceConditionContentReady) {
		r.metrics.countTotalRestores(workspace)
		lastState.recordedContentReady = true
	}

	if !lastState.recordedBackupFailed && workspace.IsConditionTrue(workspacev1.WorkspaceConditionBackupFailure) {
		r.metrics.countTotalBackups(workspace)
		r.metrics.countTotalBackupFailures(workspace)
		lastState.recordedBackupFailed = true
	}

	if !lastState.recordedBackupCompleted && workspace.IsConditionTrue(workspacev1.WorkspaceConditionBackupComplete) {
		r.metrics.countTotalBackups(workspace)
		lastState.recordedBackupCompleted = true
	}

	if !lastState.recordedStartTime && workspace.Status.Phase == workspacev1.WorkspacePhaseRunning {
		r.metrics.recordWorkspaceStartupTime(workspace)
		lastState.recordedStartTime = true
	}

	if workspace.Status.Phase == workspacev1.WorkspacePhaseStopped {
		r.metrics.countWorkspaceStop(workspace)

		if !lastState.recordedStartFailure && isStartFailure(workspace) {
			// Workspace never became ready, count as a startup failure.
			r.metrics.countWorkspaceStartFailures(workspace)
			// No need to record in metricState, as we're forgetting the workspace state next anyway.
		}

		// Forget about this workspace, no more state updates will be recorded after this.
		r.metrics.forgetWorkspace(workspace)
		return
	}

	r.metrics.rememberWorkspace(workspace, &lastState)
}

func isStartFailure(ws *workspacev1.Workspace) bool {
	// Consider workspaces that never became ready as start failures.
	everReady := ws.IsConditionTrue(workspacev1.WorkspaceConditionEverReady)
	// Except for aborted prebuilds, as they can get aborted before becoming ready, which shouldn't be counted
	// as a start failure.
	isAborted := ws.IsConditionTrue(workspacev1.WorkspaceConditionAborted)
	// Also ignore workspaces that are requested to be stopped before they became ready.
	isStoppedByRequest := ws.IsConditionTrue(workspacev1.WorkspaceConditionStoppedByRequest)
	return !everReady && !isAborted && !isStoppedByRequest
}

func (r *WorkspaceReconciler) emitPhaseEvents(ctx context.Context, ws *workspacev1.Workspace, old *workspacev1.WorkspaceStatus) {
	if ws.Status.Phase == workspacev1.WorkspacePhaseInitializing && old.Phase != workspacev1.WorkspacePhaseInitializing {
		r.Recorder.Event(ws, corev1.EventTypeNormal, "Initializing", "")
	}

	if ws.Status.Phase == workspacev1.WorkspacePhaseRunning && old.Phase != workspacev1.WorkspacePhaseRunning {
		r.Recorder.Event(ws, corev1.EventTypeNormal, "Running", "")
	}

	if ws.Status.Phase == workspacev1.WorkspacePhaseStopping && old.Phase != workspacev1.WorkspacePhaseStopping {
		r.Recorder.Event(ws, corev1.EventTypeNormal, "Stopping", "")
	}
}

func (r *WorkspaceReconciler) deleteWorkspacePod(ctx context.Context, pod *corev1.Pod, reason string) (result ctrl.Result, err error) {
	span, ctx := tracing.FromContext(ctx, "deleteWorkspacePod")
	defer tracing.FinishSpan(span, &err)

	// Workspace was requested to be deleted, propagate by deleting the Pod.
	// The Pod deletion will then trigger workspace disposal steps.
	err = r.Client.Delete(ctx, pod)
	if apierrors.IsNotFound(err) {
		// pod is gone - nothing to do here
	} else {
		return ctrl.Result{Requeue: true}, err
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) deleteWorkspaceSecrets(ctx context.Context, ws *workspacev1.Workspace) (err error) {
	span, ctx := tracing.FromContext(ctx, "deleteWorkspaceSecrets")
	owi := log.OWI(ws.Spec.Ownership.Owner, ws.Spec.Ownership.WorkspaceID, ws.Name)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	// if a secret cannot be deleted we do not return early because we want to attempt
	// the deletion of the remaining secrets
	var errs []string
	err = r.deleteSecret(ctx, fmt.Sprintf("%s-%s", ws.Name, "env"), r.Config.Namespace)
	if err != nil {
		errs = append(errs, err.Error())
		log.WithFields(owi).WithError(err).Error("could not delete environment secret")
	}

	err = r.deleteSecret(ctx, fmt.Sprintf("%s-%s", ws.Name, "tokens"), r.Config.SecretsNamespace)
	if err != nil {
		errs = append(errs, err.Error())
		log.WithFields(owi).WithError(err).Error("could not delete token secret")
	}

	if len(errs) != 0 {
		return fmt.Errorf(strings.Join(errs, ":"))
	}

	return nil
}

func (r *WorkspaceReconciler) deleteSecret(ctx context.Context, name, namespace string) error {
	err := wait.ExponentialBackoffWithContext(ctx, wait.Backoff{
		Duration: 100 * time.Millisecond,
		Factor:   1.5,
		Jitter:   0.2,
		Steps:    3,
	}, func(ctx context.Context) (bool, error) {
		var secret corev1.Secret
		err := r.Client.Get(ctx, types.NamespacedName{Name: name, Namespace: namespace}, &secret)
		if apierrors.IsNotFound(err) {
			// nothing to delete
			return true, nil
		}

		if err != nil {
			log.WithField("secret", name).WithError(err).Error("cannot retrieve secret scheduled for deletion")
			return false, nil
		}

		err = r.Client.Delete(ctx, &secret)
		if err != nil && !apierrors.IsNotFound(err) {
			log.WithError(err).WithField("secret", name).Error("cannot delete secret")
			return false, nil
		}

		return true, nil
	})

	return err
}

// errorLogConflict logs the error if it's a conflict, instead of returning it as a reconciler error.
// This is to reduce noise in our error logging, as conflicts are to be expected.
// For conflicts, instead a result with `Requeue: true` is returned, which has the same requeuing
// behaviour as returning an error.
func errorResultLogConflict(err error) (ctrl.Result, error) {
	if apierrors.IsConflict(err) {
		return ctrl.Result{RequeueAfter: 100 * time.Millisecond}, nil
	} else {
		return ctrl.Result{}, err
	}
}

var (
	wsOwnerKey = ".metadata.controller"
	apiGVStr   = workspacev1.GroupVersion.String()
)

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		Named("workspace").
		WithOptions(controller.Options{
			MaxConcurrentReconciles: r.Config.WorkspaceMaxConcurrentReconciles,
		}).
		For(&workspacev1.Workspace{}).
		WithEventFilter(predicate.NewPredicateFuncs(func(object client.Object) bool {
			_, ok := object.(*corev1.Node)
			if ok {
				return true
			}

			for k, v := range object.GetLabels() {
				if k == wsk8s.WorkspaceManagedByLabel {
					switch v {
					case constants.ManagedBy:
						return true
					default:
						return false
					}
				}
			}

			return true
		})).
		Owns(&corev1.Pod{}).
		// Add a watch for Nodes, so that they're cached in memory and don't require calling the k8s API
		// when reconciling workspaces.
		Watches(&corev1.Node{}, &handler.Funcs{
			// Only enqueue events for workspaces when the node gets deleted,
			// such that we can trigger their cleanup.
			DeleteFunc: func(ctx context.Context, e event.DeleteEvent, queue workqueue.RateLimitingInterface) {
				if e.Object == nil {
					return
				}

				var wsList workspacev1.WorkspaceList
				err := r.List(ctx, &wsList)
				if err != nil {
					log.WithError(err).Error("cannot list workspaces")
					return
				}
				for _, ws := range wsList.Items {
					if ws.Status.Runtime == nil || ws.Status.Runtime.NodeName != e.Object.GetName() {
						continue
					}
					queue.Add(ctrl.Request{NamespacedName: types.NamespacedName{
						Namespace: ws.Namespace,
						Name:      ws.Name,
					}})
				}
			},
		}).
		Complete(r)
}

func SetupIndexer(mgr ctrl.Manager) error {
	var err error
	var once sync.Once
	once.Do(func() {
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

		err = mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Pod{}, wsOwnerKey, idx)
	})

	return err
}
