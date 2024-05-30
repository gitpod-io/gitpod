// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/go-logr/logr"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

const (
	// containerKilledExitCode is the exit code Kubernetes uses for a container which was killed by the system.
	// We expect such containers to be restarted by Kubernetes if they're supposed to be running.
	// We never deliberately terminate a container like this.
	containerKilledExitCode = 137

	// containerUnknownExitCode is the exit code containerd uses if it cannot determine the cause/exit status of
	// a stopped container.
	containerUnknownExitCode = 255

	// headlessTaskFailedPrefix is the prefix of the pod termination message if a headless task failed (e.g. user error
	// or aborted prebuild).
	headlessTaskFailedPrefix = "headless task failed: "
)

func (r *WorkspaceReconciler) updateWorkspaceStatus(ctx context.Context, workspace *workspacev1.Workspace, pods *corev1.PodList, cfg *config.Configuration) (err error) {
	span, ctx := tracing.FromContext(ctx, "updateWorkspaceStatus")
	defer tracing.FinishSpan(span, &err)
	log := log.FromContext(ctx).WithValues("owi", workspace.OWI())
	ctx = logr.NewContext(ctx, log)

	oldPhase := workspace.Status.Phase
	defer func() {
		if oldPhase != workspace.Status.Phase {
			log.Info("workspace phase updated", "oldPhase", oldPhase, "phase", workspace.Status.Phase)
		}
	}()

	switch len(pods.Items) {
	case 0:
		if workspace.Status.Phase == "" {
			workspace.Status.Phase = workspacev1.WorkspacePhasePending
		}

		if workspace.Status.Phase == workspacev1.WorkspacePhaseStopping && isDisposalFinished(workspace) {
			workspace.Status.Phase = workspacev1.WorkspacePhaseStopped
		}

		workspace.UpsertConditionOnStatusChange(workspacev1.NewWorkspaceConditionContainerRunning(metav1.ConditionFalse))
		return nil
	case 1:
		// continue below
	default:
		// This is exceptional - not sure what to do here. Probably fail the pod
		workspace.Status.SetCondition(
			workspacev1.NewWorkspaceConditionFailed("multiple pods exists - this should never happen"))
		return nil
	}

	if c := wsk8s.GetCondition(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionDeployed)); c == nil {
		workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionDeployed())
	}

	pod := &pods.Items[0]

	if workspace.Status.Runtime == nil {
		workspace.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{}
	}
	if workspace.Status.Runtime.NodeName == "" && pod.Spec.NodeName != "" {
		workspace.Status.Runtime.NodeName = pod.Spec.NodeName
	}
	if workspace.Status.Runtime.HostIP == "" && pod.Status.HostIP != "" {
		workspace.Status.Runtime.HostIP = pod.Status.HostIP
	}
	if workspace.Status.Runtime.PodIP == "" && pod.Status.PodIP != "" {
		workspace.Status.Runtime.PodIP = pod.Status.PodIP
	}
	if workspace.Status.Runtime.PodName == "" && pod.Name != "" {
		workspace.Status.Runtime.PodName = pod.Name
	}

	// Check if the node has disappeared. If so, ws-daemon has also disappeared and we need to
	// mark the workspace backup as failed if it didn't complete disposal yet.
	// Otherwise, the workspace will be stuck in the Stopping phase forever.
	if err := r.checkNodeDisappeared(ctx, workspace, pod); err != nil {
		return err
	}

	if workspace.Status.URL == "" {
		url, err := config.RenderWorkspaceURL(cfg.WorkspaceURLTemplate, workspace.Name, workspace.Spec.Ownership.WorkspaceID, cfg.GitpodHostURL)
		if err != nil {
			return xerrors.Errorf("cannot get workspace URL: %w", err)
		}
		workspace.Status.URL = url
	}

	if workspace.Status.OwnerToken == "" {
		ownerToken, err := getRandomString(32)
		if err != nil {
			return xerrors.Errorf("cannot create owner token: %w", err)
		}
		workspace.Status.OwnerToken = ownerToken
	}

	failure, phase := r.extractFailure(ctx, workspace, pod)
	if phase != nil {
		workspace.Status.Phase = *phase
	}

	if failure != "" && !workspace.IsConditionTrue(workspacev1.WorkspaceConditionFailed) {
		// workspaces can fail only once - once there is a failed condition set, stick with it
		log.Info("workspace failed", "workspace", workspace.Name, "reason", failure)
		workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionFailed(failure))
		r.Recorder.Event(workspace, corev1.EventTypeWarning, "Failed", failure)
	}

	if workspace.IsHeadless() && !workspace.IsConditionTrue(workspacev1.WorkspaceConditionsHeadlessTaskFailed) {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Terminated != nil && cs.State.Terminated.Message != "" {
				workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionHeadlessTaskFailed(cs.State.Terminated.Message))
				break
			}
		}
	}

	if isWorkspaceContainerRunning(pod.Status.ContainerStatuses) {
		workspace.UpsertConditionOnStatusChange(workspacev1.NewWorkspaceConditionContainerRunning(metav1.ConditionTrue))
	} else {
		workspace.UpsertConditionOnStatusChange(workspacev1.NewWorkspaceConditionContainerRunning(metav1.ConditionFalse))
	}

	switch {
	case isPodBeingDeleted(pod):
		if workspace.Status.Phase == workspacev1.WorkspacePhaseStopping && isDisposalFinished(workspace) {
			workspace.Status.Phase = workspacev1.WorkspacePhaseStopped
		} else if workspace.Status.Phase != workspacev1.WorkspacePhaseStopped {
			// Move to (or stay in) Stopping if not yet Stopped.
			workspace.Status.Phase = workspacev1.WorkspacePhaseStopping
		}

	case pod.Status.Phase == corev1.PodPending:
		var creating bool
		// check if any container is still pulling images
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Waiting != nil {
				switch cs.State.Waiting.Reason {
				case "ContainerCreating", "ImagePullBackOff", "ErrImagePull":
					creating = true
				}

				if creating {
					break
				}
			}
		}
		if creating {
			workspace.Status.Phase = workspacev1.WorkspacePhaseCreating
		} else {
			workspace.Status.Phase = workspacev1.WorkspacePhasePending
		}

	case pod.Status.Phase == corev1.PodRunning:
		everReady := workspace.IsConditionTrue(workspacev1.WorkspaceConditionEverReady)
		if everReady {
			// If the workspace has been ready before, stay in a Running state, even
			// if the workspace container is not ready anymore. This is to avoid the workspace
			// moving back to Initializing and becoming unusable.
			workspace.Status.Phase = workspacev1.WorkspacePhaseRunning
		} else {
			contentReady := workspace.IsConditionTrue(workspacev1.WorkspaceConditionContentReady)
			var ideReady bool
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Ready {
					ideReady = true
					break
				}
			}
			ready := contentReady && ideReady

			if ready {
				// workspace is ready - hence content init is done
				workspace.Status.Phase = workspacev1.WorkspacePhaseRunning
				if !workspace.IsConditionTrue(workspacev1.WorkspaceConditionEverReady) {
					workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionEverReady())
				}
			} else {
				// workspace has not become ready yet - it must be initializing then.
				workspace.Status.Phase = workspacev1.WorkspacePhaseInitializing
			}
		}

	case workspace.IsHeadless() && (pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed):
		if pod.Status.Phase == corev1.PodSucceeded && !workspace.IsConditionTrue(workspacev1.WorkspaceConditionEverReady) {
			// Fix for Prebuilds that instantly succeed (e.g. empty task), sometimes we don't observe the
			// workspace `Running` phase for these, and never had the opportunity to add the EverReady condition.
			// This would then cause a "start failure" in the metrics. So we retroactively add the EverReady
			// condition here if the pod succeeded.
			workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionEverReady())
		}

		if workspace.Status.Phase == workspacev1.WorkspacePhaseStopping && isDisposalFinished(workspace) {
			workspace.Status.Phase = workspacev1.WorkspacePhaseStopped
		} else if workspace.Status.Phase != workspacev1.WorkspacePhaseStopped {
			// Should be in Stopping phase, but isn't yet.
			// Move to Stopping to start disposal, but only if maintenance mode is disabled.
			if !r.maintenance.IsEnabled(ctx) {
				workspace.Status.Phase = workspacev1.WorkspacePhaseStopping
			}
		}

	case pod.Status.Phase == corev1.PodUnknown:
		workspace.Status.Phase = workspacev1.WorkspacePhaseUnknown

	default:
		log.Info("cannot determine workspace phase", "podStatus", pod.Status)
		workspace.Status.Phase = workspacev1.WorkspacePhaseUnknown

	}

	return nil
}

func (r *WorkspaceReconciler) checkNodeDisappeared(ctx context.Context, workspace *workspacev1.Workspace, pod *corev1.Pod) (err error) {
	span, ctx := tracing.FromContext(ctx, "checkNodeDisappeared")
	defer tracing.FinishSpan(span, &err)

	if pod.Spec.NodeName == "" {
		// Not yet scheduled.
		return nil
	}

	var node corev1.Node
	err = r.Get(ctx, types.NamespacedName{Namespace: "", Name: pod.Spec.NodeName}, &node)
	if err == nil || !errors.IsNotFound(err) {
		return err
	}

	// If NodeDisappeared is already set, return early, we've already made the below checks previously.
	if workspace.IsConditionTrue(workspacev1.WorkspaceConditionNodeDisappeared) {
		return nil
	}

	if !isDisposalFinished(workspace) {
		// Node disappeared before a backup could be taken, mark it with a backup failure.
		log.FromContext(ctx).Error(nil, "workspace node disappeared while disposal has not finished yet", "node", pod.Spec.NodeName)
		workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionBackupFailure("workspace node disappeared before backup was taken"))
	}

	// Must set this after checking isDisposalFinished, as that method also checks for the NodeDisappeared condition.
	workspace.Status.SetCondition(workspacev1.NewWorkspaceConditionNodeDisappeared())
	return nil
}

func isDisposalFinished(ws *workspacev1.Workspace) bool {
	return ws.IsConditionTrue(workspacev1.WorkspaceConditionBackupComplete) ||
		ws.IsConditionTrue(workspacev1.WorkspaceConditionBackupFailure) ||
		ws.IsConditionTrue(workspacev1.WorkspaceConditionAborted) ||
		// Nothing to dispose if content wasn't ready.
		!ws.IsConditionTrue(workspacev1.WorkspaceConditionContentReady) ||
		// Can't dispose if node disappeared.
		ws.IsConditionTrue(workspacev1.WorkspaceConditionNodeDisappeared) ||
		// Image builds have nothing to dispose.
		ws.Spec.Type == workspacev1.WorkspaceTypeImageBuild
}

// extractFailure returns a pod failure reason and possibly a phase. If phase is nil then
// one should extract the phase themselves. If the pod has not failed, this function returns "", nil.
// This failure is then stored in the Failed condition on the workspace.
func (r *WorkspaceReconciler) extractFailure(ctx context.Context, ws *workspacev1.Workspace, pod *corev1.Pod) (string, *workspacev1.WorkspacePhase) {
	// Check for content init failure.
	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c != nil {
		if c.Status == metav1.ConditionFalse && c.Reason == workspacev1.ReasonInitializationFailure {
			msg := c.Message
			if msg == "" {
				msg = "Content initialization failed for an unknown reason"
			} else {
				msg = fmt.Sprintf("Content initialization failed: %s", msg)
			}
			return msg, nil
		}
	}

	// Check for backup failure.
	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionBackupFailure)); c != nil {
		msg := c.Message
		if msg == "" {
			msg = "Backup failed for an unknown reason"
		} else {
			msg = fmt.Sprintf("Backup failed: %s", msg)
		}
		return msg, nil
	}

	status := pod.Status
	if status.Phase == corev1.PodFailed && (status.Reason != "" || status.Message != "") {
		// Don't force the phase to UNKNONWN here to leave a chance that we may detect the actual phase of
		// the workspace, e.g. stopping.
		return fmt.Sprintf("%s: %s", status.Reason, status.Message), nil
	}

	for _, cs := range status.ContainerStatuses {
		if cs.State.Waiting != nil {
			if cs.State.Waiting.Reason == "ImagePullBackOff" || cs.State.Waiting.Reason == "ErrImagePull" {
				// If the image pull failed we were definitely in the api.WorkspacePhase_CREATING phase,
				// unless of course this pod has been deleted already.
				var res *workspacev1.WorkspacePhase
				if isPodBeingDeleted(pod) {
					// The pod is being deleted already and we have to decide the phase based on the presence of the
					// finalizer and disposal status annotation. That code already exists in the remainder of getStatus,
					// hence we defer the decision.
					res = nil
				} else {
					c := workspacev1.WorkspacePhaseCreating
					res = &c
				}
				return fmt.Sprintf("cannot pull image: %s", cs.State.Waiting.Message), res
			}
		}

		terminationState := cs.State.Terminated
		if terminationState == nil {
			terminationState = cs.LastTerminationState.Terminated
		}
		if terminationState != nil {
			// a workspace terminated container is not neccesarily bad. During shutdown workspaces containers
			// can go in this state and that's ok. However, if the workspace was shutting down due to deletion,
			// we would not be here as we've checked for a DeletionTimestamp prior. So let's find out why the
			// container is terminating.
			if terminationState.ExitCode != 0 && terminationState.Message != "" {
				var phase *workspacev1.WorkspacePhase
				if !isPodBeingDeleted(pod) {
					// If the wrote a termination message and is not currently being deleted,
					// then it must have been/be running. If we did not force the phase here,
					// we'd be in unknown.
					running := workspacev1.WorkspacePhaseRunning
					phase = &running
				}

				if terminationState.ExitCode == containerKilledExitCode && terminationState.Reason == "ContainerStatusUnknown" {
					// For some reason, the pod is killed with unknown container status and no taints on the underlying node.
					// Therefore, we skip extracting the failure from the terminated message.
					// ref: https://github.com/gitpod-io/gitpod/issues/12021
					var node corev1.Node
					if ws.Status.Runtime != nil && ws.Status.Runtime.NodeName != "" {
						if err := r.Get(ctx, types.NamespacedName{Namespace: "", Name: ws.Status.Runtime.NodeName}, &node); err == nil && len(node.Spec.Taints) == 0 {
							return "", nil
						}
					}
				}

				if ws.IsHeadless() && strings.HasPrefix(terminationState.Message, headlessTaskFailedPrefix) {
					// Headless task failed, not a workspace failure.
					return "", nil
				}

				// the container itself told us why it was terminated - use that as failure reason
				return extractFailureFromLogs([]byte(terminationState.Message)), phase
			} else if terminationState.Reason == "Error" {
				if !isPodBeingDeleted(pod) && terminationState.ExitCode != containerKilledExitCode {
					phase := workspacev1.WorkspacePhaseRunning
					return fmt.Sprintf("container %s ran with an error: exit code %d", cs.Name, terminationState.ExitCode), &phase
				}
			} else if terminationState.Reason == "Completed" && !isPodBeingDeleted(pod) {
				// Headless workspaces are expected to finish.
				if !ws.IsHeadless() {
					return fmt.Sprintf("container %s completed; containers of a workspace pod are not supposed to do that", cs.Name), nil
				}
			} else if !isPodBeingDeleted(pod) && terminationState.ExitCode != containerUnknownExitCode {
				// if a container is terminated and it wasn't because of either:
				//  - regular shutdown
				//  - the exit code "UNKNOWN" (which might be caused by an intermittent issue and is handled in extractStatusFromPod)
				//  - another known error
				// then we report it as UNKNOWN
				phase := workspacev1.WorkspacePhaseUnknown
				return fmt.Sprintf("workspace container %s terminated for an unknown reason: (%s) %s", cs.Name, terminationState.Reason, terminationState.Message), &phase
			}
		}
	}

	return "", nil
}

func isWorkspaceContainerRunning(statuses []corev1.ContainerStatus) bool {
	for _, cs := range statuses {
		if cs.Name == "workspace" {
			if cs.State.Running != nil {
				return true
			}
			break
		}
	}
	return false
}

// extractFailureFromLogs attempts to extract the last error message from a workspace
// container's log output.
func extractFailureFromLogs(logs []byte) string {
	var sep = []byte("\n")
	var msg struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}

	var nidx int
	for idx := bytes.LastIndex(logs, sep); idx > 0; idx = nidx {
		nidx = bytes.LastIndex(logs[:idx], sep)
		if nidx < 0 {
			nidx = 0
		}

		line := logs[nidx:idx]
		err := json.Unmarshal(line, &msg)
		if err != nil {
			continue
		}

		if msg.Message == "" {
			continue
		}

		if msg.Error == "" {
			return msg.Message
		}

		return msg.Message + ": " + msg.Error
	}

	return string(logs)
}

// isPodBeingDeleted returns true if the pod is currently being deleted
func isPodBeingDeleted(pod *corev1.Pod) bool {
	// if the pod is being deleted the only marker we have is that the deletionTimestamp is set
	return pod.ObjectMeta.DeletionTimestamp != nil
}

// isWorkspaceBeingDeleted returns true if the workspace resource is currently being deleted.
func isWorkspaceBeingDeleted(ws *workspacev1.Workspace) bool {
	return ws.ObjectMeta.DeletionTimestamp != nil
}
