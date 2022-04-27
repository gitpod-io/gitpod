// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	corev1 "k8s.io/api/core/v1"
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
)

func updateWorkspaceStatus(ctx context.Context, workspace *workspacev1.Workspace, pods corev1.PodList) error {
	log := log.FromContext(ctx)

	switch len(pods.Items) {
	case 0:
		workspace.Status.Available = false
		if workspace.Status.Phase != workspacev1.WorkspacePhasePending {
			workspace.Status.Phase = workspacev1.WorkspacePhaseStopped
		}
		return nil
	case 1:
		// continue below
	default:
		// This is exceptional - not sure what to do here. Probably fail the pod
		workspace.Status.Conditions.Failed = "multiple pods exists - this should never happen"
		return nil
	}

	workspace.Status.Conditions.Deployed = true

	pod := &pods.Items[0]

	if workspace.Status.Runtime == nil {
		workspace.Status.Runtime = &workspacev1.WorkspaceRuntimeStatus{}
	}
	if workspace.Status.Runtime.NodeName == "" && pod.Spec.NodeName != "" {
		workspace.Status.Runtime.NodeName = pod.Spec.NodeName
	}
	if workspace.Status.Runtime.HostIP == "" && pod.Status.HostIP != "" {
		workspace.Status.Runtime.HostIP = pod.Spec.NodeName
	}
	if workspace.Status.Runtime.PodName == "" && pod.Name != "" {
		workspace.Status.Runtime.PodName = pod.Name
	}

	failure, phase := extractFailure(workspace, pod)
	if phase != nil {
		workspace.Status.Phase = *phase
	}
	if workspace.Status.Conditions.Failed == "" {
		// workspaces can fail only once - once there is a failed condition set, stick with it
		workspace.Status.Conditions.Failed = failure
	}

	switch {
	case isPodBeingDeleted(pod):
		workspace.Status.Phase = workspacev1.WorkspacePhaseStopping

		var hasFinalizer bool
		for _, f := range pod.Finalizers {
			if f == gitpodPodFinalizerName {
				hasFinalizer = true
				break
			}
		}
		if !hasFinalizer {
			// We do this independently of the dispostal status because pods only get their finalizer
			// once they're running. If they fail before they reach the running phase we'll never see
			// a disposal status, hence would never stop the workspace.
			workspace.Status.Phase = workspacev1.WorkspacePhaseStopped
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
		// TODO(cw): port interrupted handling - after making sure this is even still relevant

		if workspace.Status.Headless && workspace.Spec.Type != workspacev1.WorkspaceTypePrebuild {
			// headless workspaces (except prebuilds) don't expose a public service and thus cannot be asked about their status.
			// once kubernetes reports the workspace running, so do we.
			workspace.Status.Phase = workspacev1.WorkspacePhaseRunning
		} else if workspace.Status.Conditions.EverReady {
			// workspcae has been marked ready by a workspace-ready probe of the monitor
			workspace.Status.Phase = workspacev1.WorkspacePhaseRunning
		} else {
			// workspace has not yet been marked ready by one of monitor's probes. It must be initializing then.
			workspace.Status.Phase = workspacev1.WorkspacePhaseInitializing
		}

	case workspace.Status.Headless && (pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed):
		workspace.Status.Phase = workspacev1.WorkspacePhaseStopping

	case pod.Status.Phase == corev1.PodUnknown:
		workspace.Status.Phase = workspacev1.WorkspacePhaseUnknown

	default:
		log.Info("cannot determine workspace phase")
		workspace.Status.Phase = workspacev1.WorkspacePhaseUnknown

	}

	return nil
}

// extractFailure returns a pod failure reason and possibly a phase. If phase is nil then
// one should extract the phase themselves. If the pod has not failed, this function returns "", nil.
func extractFailure(ws *workspacev1.Workspace, pod *corev1.Pod) (string, *workspacev1.WorkspacePhase) {
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
				var phase workspacev1.WorkspacePhase
				if !isPodBeingDeleted(pod) {
					// If the wrote a termination message and is not currently being deleted,
					// then it must have been/be running. If we did not force the phase here,
					// we'd be in unknown.
					phase = workspacev1.WorkspacePhaseRunning
				}

				// the container itself told us why it was terminated - use that as failure reason
				return extractFailureFromLogs([]byte(terminationState.Message)), &phase
			} else if terminationState.Reason == "Error" {
				if !isPodBeingDeleted(pod) && terminationState.ExitCode != containerKilledExitCode {
					phase := workspacev1.WorkspacePhaseRunning
					return fmt.Sprintf("container %s ran with an error: exit code %d", cs.Name, terminationState.ExitCode), &phase
				}
			} else if terminationState.Reason == "Completed" {
				if ws.Status.Headless {
					// default way for headless workspaces to be done
					return "", nil
				}
				return fmt.Sprintf("container %s completed; containers of a workspace pod are not supposed to do that", cs.Name), nil
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
