/*
Copyright 2021.
*/

package controllers

import (
	"context"
	"time"

	"golang.org/x/sync/singleflight"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"

	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/pkg/kubeapi/v1"
	corev1 "k8s.io/api/core/v1"
)

func NewWorkspaceReconciler(client client.Client, scheme *runtime.Scheme, cfg config.Configuration) *WorkspaceReconciler {
	return &WorkspaceReconciler{
		Client: client,
		Scheme: scheme,
		Config: &cfg,
		actor: &actorImpl{
			Client: client,
			Config: &cfg,
		},
	}
}

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
	Config *config.Configuration

	actor actor
}

const (
	// stopWorkspaceNormallyGracePeriod is the grace period we use when stopping a pod with StopWorkspaceNormally policy
	stopWorkspaceNormallyGracePeriod = 30 * time.Second

	gitpodFinalizerName = "gitpod.io/finalizer"
)

//+kubebuilder:rbac:groups=crd.gitpod.io,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=crd.gitpod.io,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=crd.gitpod.io,resources=workspaces/finalizers,verbs=update

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
// the Workspace object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.8.3/pkg/reconcile
func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	err := r.Get(ctx, req.NamespacedName, &workspace)
	if err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if workspace.Spec.Pod == "" {
		// workspace has no pod yet, that's ok
		log.V(1).Info("workspace has no pod")
		return ctrl.Result{}, nil
	}

	var pod corev1.Pod
	err = r.Get(ctx, client.ObjectKey{Namespace: req.Namespace, Name: workspace.Spec.Pod}, &pod)
	if err != nil {
		return ctrl.Result{}, err
	}

	wso := workspaceObjects{
		Workspace: &workspace,
		Pod:       &pod,
	}
	s, err := getWorkspaceStatus(wso)
	if err != nil {
		log.V(1).Error(err, "cannot get status update")
		return ctrl.Result{}, err
	}
	err = actOnPodEvent(ctx, r.actor, s, &wso)
	if err != nil {
		log.V(1).Error(err, "cannot get status update")
		return ctrl.Result{}, err
	}
	workspace.Status = *s

	err = r.Status().Update(ctx, &workspace)
	if err != nil {
		log.V(1).Error(err, "cannot update status")
		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

type actor interface {
	// InitializeWorkspaceContent initializes the workspace content. If this operation is already ongoing,
	// no new attempt is made (the call is idempotent).
	InitializeWorkspaceContent(ctx context.Context, workspace *workspacev1.Workspace) (err error)

	// ClearInitializer "resets the idempotency" of InitializeWorkspaceContent.
	ClearInitializer(instanceID string)

	// WaitForWorkspaceReady waits until the workspace is actually up and running
	WaitForWorkspaceReady(ctx context.Context, instanceID string) (err error)

	// StopWorkspace stops a running workspace
	StopWorkspace(ctx context.Context, instanceID string, gracePeriod time.Duration) error

	// FinalizeWorkspaceContent triggers workspace content finalization. This call is idempotent.
	FinalizeWorkspaceContent(ctx context.Context, workspace *workspacev1.Workspace)

	// ModifyFinalizer adds or removes the gitpod finalizer to/from a pod
	ModifyFinalizer(ctx context.Context, instanceID string, add bool) error
}

type actorImpl struct {
	Client client.Client
	Config *config.Configuration

	initializer singleflight.Group
	finalizer   singleflight.Group
}

var _ actor = &actorImpl{}

// InitializeWorkspaceContent initializes the workspace content. If this operation is already ongoing,
// no new attempt is made (the call is idempotent).
func (a *actorImpl) InitializeWorkspaceContent(ctx context.Context, workspace *workspacev1.Workspace) (err error) {
	_, err, _ = a.initializer.Do(workspace.Name, func() (interface{}, error) {
		log := log.FromContext(ctx)
		log.V(1).Info("InitializeWorkspaceContent", workspace.OWI())

		// TODO(cw): implement actual content init
		return nil, nil
	})
	return
}

// ClearInitializer "resets the idempotency" of InitializeWorkspaceContent.
func (a *actorImpl) ClearInitializer(instanceID string) {
	a.initializer.Forget(instanceID)
}

// WaitForWorkspaceReady waits until the workspace is actually up and running
func (a *actorImpl) WaitForWorkspaceReady(ctx context.Context, instanceID string) (err error) {
	// TODO(cw): implement me
	log.FromContext(ctx).V(1).Info("WaitForWorkspaceReady", instanceID)
	return nil
}

// StopWorkspace stops a running workspace
func (a *actorImpl) StopWorkspace(ctx context.Context, instanceID string, gracePeriod time.Duration) error {
	// TODO(cw): implement me
	log.FromContext(ctx).V(1).Info("StopWorkspace", instanceID)
	return nil
}

// FinalizeWorkspaceContent triggers workspace content finalization. This call is idempotent.
func (a *actorImpl) FinalizeWorkspaceContent(ctx context.Context, workspace *workspacev1.Workspace) {
	a.finalizer.Do(workspace.Name, func() (interface{}, error) {
		defer a.finalizer.Forget(workspace.Name)

		// TODO(cw): implement me
		log.FromContext(ctx).V(1).Info("FinalizeWorkspaceContent", workspace.Name)
		return nil, nil
	})
}

// ModifyFinalizer adds or removes the gitpod finalizer to/from a pod
func (a *actorImpl) ModifyFinalizer(ctx context.Context, instanceID string, add bool) error {
	// Retry on failure. Sometimes this doesn't work because of concurrent modification. The Kuberentes way is to just try again after waiting a bit.
	return retry.RetryOnConflict(retry.DefaultBackoff, func() (err error) {
		span, ctx := tracing.FromContext(ctx, "ModifyFinalizer")
		// tracing.ApplyOWI(span, log.OWI("", "", workspaceID))
		defer tracing.FinishSpan(span, &err)
		span.LogKV("add", add)

		var workspace workspacev1.Workspace
		err = a.Client.Get(ctx, types.NamespacedName{Namespace: a.Config.Namespace, Name: instanceID}, &workspace)
		if err != nil {
			if errors.IsNotFound(err) {
				return nil
			}

			return xerrors.Errorf("unexpected error searching workspace %s: %w", instanceID, err)
		}

		var update bool
		if add {
			var exists bool
			for _, x := range workspace.Finalizers {
				if x == gitpodFinalizerName {
					exists = true
					break
				}
			}
			if !exists {
				workspace.Finalizers = append(workspace.Finalizers, gitpodFinalizerName)
				update = true
			}
		} else {
			n := 0
			for _, x := range workspace.Finalizers {
				if x == gitpodFinalizerName {
					update = true
				} else {
					workspace.Finalizers[n] = x
					n++
				}
			}
			workspace.Finalizers = workspace.Finalizers[:n]
		}

		if !update {
			return nil
		}

		return a.Client.Update(ctx, &workspace)
	})
}

// actOnPodEvent performs actions when a kubernetes event comes in. For example we shut down failed workspaces or start
// polling the ready state of initializing ones.
func actOnPodEvent(ctx context.Context, actor actor, status *workspacev1.WorkspaceStatus, wso *workspaceObjects) (err error) {
	if status.Phase == workspacev1.PhaseStopping || status.Phase == workspacev1.PhaseStopped {
		// Beware: do not else-if this condition with the other phases as we don't want the stop
		//         login in any other phase, too.
		actor.ClearInitializer(wso.Workspace.Name)

		// Special case: workspaces timing out during backup. Normally a timed out workspace would just be stopped
		//               regularly. When a workspace times out during backup though, stopping it won't do any good.
		//               The workspace is already shutting down, it just fails to do so properly. Instead, we need
		//               to update the disposal status to reflect this timeout situation.

		// TODO(cw): add timeout support

		// if status.Conditions.Timeout != "" && strings.Contains(status.Conditions.Timeout, string(activityBackup)) {
		// 	err = func() error {
		// 		b, err := json.Marshal(workspaceDisposalStatus{BackupComplete: true, BackupFailure: status.Conditions.Timeout})
		// 		if err != nil {
		// 			return err
		// 		}

		// 		err = m.markWorkspace(ctx, workspaceID, addMark(disposalStatusAnnotation, string(b)))
		// 		if err != nil {
		// 			return err
		// 		}
		// 		return nil
		// 	}()
		// 	if err != nil {
		// 		log.WithError(err).Error("was unable to update pod's disposal state - this will break someone's experience")
		// 	}
		// }

		return actor.ModifyFinalizer(ctx, wso.Workspace.Name, false)
	} else if status.Conditions.Failed != "" || status.Conditions.Timeout != "" {
		// the workspace has failed to run/start - shut it down
		// we should mark the workspace as failedBeforeStopping - this way the failure status will persist
		// while we stop the workspace
		status.Control.FailedBeforeStopping = true

		// At the moment we call stopWorkspace on the same workspace at least twice:
		// First when the workspace originally failed, and
		// second when adding the workspaceFailedBeforeStoppingAnnotation which in turn triggers a new pod event.
		//
		// The alternative is to stop the pod only when the workspaceFailedBeforeStoppingAnnotation is present.
		// However, that's much more brittle than stopping the workspace twice (something that Kubernetes can handle).
		// It is important that we do not fail here if the pod is already gone, i.e. when we lost the race.

		err := actor.StopWorkspace(ctx, wso.Workspace.Name, stopWorkspaceNormallyGracePeriod)
		if err != nil && !errors.IsNotFound(err) {
			return xerrors.Errorf("cannot stop workspace: %w", err)
		}

		return nil
	}

	if status.Phase == workspacev1.PhaseCreating {
		// The workspace has been scheduled on the cluster which means that we can start initializing it
		go func() {
			err := actor.InitializeWorkspaceContent(ctx, wso.Workspace)

			if err != nil {
				status.Conditions.Failed = err.Error()
			}
		}()
	}

	if status.Phase == workspacev1.PhaseInitializing {
		// workspace is initializing (i.e. running but without the ready annotation yet). Start probing and depending on
		// the result add the appropriate annotation or stop the workspace. waitForWorkspaceReady takes care that it does not
		// run for the same workspace multiple times.
		go func() {
			err := actor.WaitForWorkspaceReady(ctx, wso.Workspace.Name)

			if err != nil {
				// workspace initialization failed, which means the workspace as a whole failed
				status.Conditions.Failed = err.Error()
			}
		}()
	}

	if status.Phase == workspacev1.PhaseRunning {
		// We need to register the finalizer before the pod is deleted (see https://book.kubebuilder.io/reference/using-finalizers.html).
		err = actor.ModifyFinalizer(ctx, wso.Workspace.Name, true)
		if err != nil {
			return xerrors.Errorf("cannot add gitpod finalizer: %w", err)
		}

		// once a regular workspace is up and running, we'll remove the traceID information so that the parent span
		// ends once the workspace has started.
		//
		// Also, in case the pod gets evicted we would not know the hostIP that pod ran on anymore.
		// In preparation for those cases, we'll add it as an annotation.
		status.Runtime.Node = wso.Pod.Spec.NodeName
	}

	if status.Phase == workspacev1.PhaseStopping {
		if !isPodBeingDeleted(wso.Pod) {
			// this might be the case if a headless workspace has just completed but has not been deleted by anyone, yet

			err := actor.StopWorkspace(ctx, wso.Workspace.Name, stopWorkspaceNormallyGracePeriod)
			if err != nil && !errors.IsNotFound(err) {
				return xerrors.Errorf("cannot stop workspace: %w", err)
			}
			return nil
		}

		go actor.FinalizeWorkspaceContent(ctx, wso.Workspace)
	}

	if status.Phase == workspacev1.PhaseStopped {
		// we've disposed already - try to remove the finalizer and call it a day
		return actor.ModifyFinalizer(ctx, wso.Workspace.Name, false)
	}

	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&workspacev1.Workspace{}).
		Owns(&corev1.Pod{}, builder.WithPredicates(predicate.NewPredicateFuncs(isWorkspacePodObject))).
		Owns(&corev1.Service{}, builder.WithPredicates(predicate.NewPredicateFuncs(isWorkspacePodObject))).
		Complete(r)
}

func isWorkspacePodObject(obj client.Object) bool {
	_, ok := obj.GetLabels()["gpwsman"]
	return ok
}
