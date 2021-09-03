/*
Copyright 2021.
*/

package controllers

import (
	"context"

	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/pkg/kubeapi/v1"
	corev1 "k8s.io/api/core/v1"
)

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

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
	err = actOnPodEvent(ctx, s, &wso)
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

// actOnPodEvent performs actions when a kubernetes event comes in. For example we shut down failed workspaces or start
// polling the ready state of initializing ones.
func actOnPodEvent(ctx context.Context, status *workspacev1.WorkspaceStatus, wso *workspaceObjects) (err error) {
	pod := wso.Pod

	if status.Phase == workspacev1.PhaseStopping || status.Phase == workspacev1.PhaseStopped {
		// Beware: do not else-if this condition with the other phases as we don't want the stop
		//         login in any other phase, too.
		// m.clearInitializerFromMap(pod.Name)

		// Special case: workspaces timing out during backup. Normally a timed out workspace would just be stopped
		//               regularly. When a workspace times out during backup though, stopping it won't do any good.
		//               The workspace is already shutting down, it just fails to do so properly. Instead, we need
		//               to update the disposal status to reflect this timeout situation.

		// We don't support timeouts yet

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

		// we don't actively interact yet

		// err := m.stopWorkspace(ctx, workspaceID, stopWorkspaceNormallyGracePeriod)
		// if err != nil && !isKubernetesObjNotFoundError(err) {
		// 	return xerrors.Errorf("cannot stop workspace: %w", err)
		// }

		return nil
	}

	if status.Phase == workspacev1.PhaseCreating {
		// The workspace has been scheduled on the cluster which means that we can start initializing it
		go func() {
			// err := m.initializeWorkspaceContent(ctx, pod)

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
			// err := m.waitForWorkspaceReady(ctx, pod)

			if err != nil {
				// workspace initialization failed, which means the workspace as a whole failed
				status.Conditions.Failed = err.Error()
			}
		}()
	}

	if status.Phase == workspacev1.PhaseRunning {
		// We need to register the finalizer before the pod is deleted (see https://book.kubebuilder.io/reference/using-finalizers.html).
		// TODO (cw): Figure out if we can replace the "neverReady" flag.
		// err = m.modifyFinalizer(ctx, workspaceID, gitpodFinalizerName, true)
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
		if !isPodBeingDeleted(pod) {
			// this might be the case if a headless workspace has just completed but has not been deleted by anyone, yet

			// err := m.stopWorkspace(ctx, workspaceID, stopWorkspaceNormallyGracePeriod)
			// if err != nil && !isKubernetesObjNotFoundError(err) {
			// 	return xerrors.Errorf("cannot stop workspace: %w", err)
			// }
			return nil
		}

		// go m.finalizeWorkspaceContent(ctx, wso)
	}

	if status.Phase == workspacev1.PhaseStopped {
		// we've disposed already - try to remove the finalizer and call it a day
		// return m.modifyFinalizer(ctx, workspaceID, gitpodFinalizerName, false)
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
