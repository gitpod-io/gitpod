// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/pkg/kubeapi/v1"
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

// workspaceObjects contains all Kubernetes objects required to compute the status of a workspace
type workspaceObjects struct {
	Workspace    *workspacev1.Workspace `json:"workspace"`
	Pod          *corev1.Pod            `json:"pod"`
	TheiaService *corev1.Service        `json:"theiaService,omitempty"`
	PortsService *corev1.Service        `json:"portsService,omitempty"`
	Events       []corev1.Event         `json:"events,omitempty"`
}

// GetOWI produces the owner, workspace, instance tripple that we use for tracing and logging
func (wso *workspaceObjects) GetOWI() logrus.Fields {
	if wso.Pod != nil {
		return wsk8s.GetOWIFromObject(&wso.Pod.ObjectMeta)
	}
	return logrus.Fields{}
}

// IsWorkspaceHeadless returns true if the workspace described by these objects is headless
func (wso *workspaceObjects) IsWorkspaceHeadless() bool {
	if wso.Workspace != nil {
		return wso.Workspace.Status.Headless
	}
	return false
}

func (wso *workspaceObjects) WorkspaceType() (api.WorkspaceType, error) {
	if wso.Workspace != nil {
		return api.WorkspaceType_REGULAR, xerrors.Errorf("cannot determine pod type")
	}

	lbl := string(wso.Workspace.Spec.Workspace.Type)
	val, ok := api.WorkspaceType_value[strings.ToUpper(lbl)]
	if !ok {
		// pod has invalid type label - we assume it's a regular pod
		return api.WorkspaceType_REGULAR, xerrors.Errorf("pod has invalid type: %s", lbl)
	}

	return api.WorkspaceType(val), nil
}

// WorkspaceID returns the ID of the workspace
func (wso *workspaceObjects) WorkspaceID() (id string, ok bool) {
	if wso.Workspace == nil {
		return "", false
	}

	return wso.Workspace.Spec.Metadata.WorkspaceID, true
}

func (wso *workspaceObjects) WasEverReady() (res bool) {
	if wso.Workspace == nil {
		// We assume the pod was ready by default, even if we have nothing to show for it.
		// The real world has shown that this produces the more favorable failure modes.
		return true
	}

	return wso.Workspace.Status.Control.WasEverReady
}

// HostName returns the name of the node this workspace is/was deployed to. If this workspace has never been deployed anywhere, HostName returns an empty string.
func (wso *workspaceObjects) NodeName() string {
	if wso.Workspace == nil {
		return ""
	}

	return wso.Workspace.Status.Runtime.Node
}

// completeWorkspaceObjects finds the remaining Kubernetes objects based on the pod description
// or pod lifecycle indepedent state.
// func (m *Manager) completeWorkspaceObjects(ctx context.Context, wso *workspaceObjects) error {
// 	if wso.Pod == nil {
// 		return xerrors.Errorf("completeWorkspaceObjects: need either pod or lifecycle independent state")
// 	}

// 	// find our service prefix to see if the services still exist
// 	servicePrefix := ""
// 	if wso.Pod != nil {
// 		servicePrefix = wso.Pod.Annotations[servicePrefixAnnotation]
// 	}
// 	if servicePrefix == "" {
// 		return xerrors.Errorf("completeWorkspaceObjects: no service prefix found")
// 	}
// 	if wso.TheiaService == nil {
// 		var service corev1.Service
// 		err := m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: getTheiaServiceName(servicePrefix)}, &service)
// 		if err == nil {
// 			wso.TheiaService = &service
// 		}

// 		if !isKubernetesObjNotFoundError(err) && err != nil {
// 			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
// 		}
// 	}
// 	if wso.PortsService == nil {
// 		var service corev1.Service
// 		err := m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: getPortsServiceName(servicePrefix)}, &service)
// 		if err == nil {
// 			wso.PortsService = &service
// 		}

// 		if !isKubernetesObjNotFoundError(err) && err != nil {
// 			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
// 		}
// 	}

// 	// find pod events - this only makes sense if we still have a pod
// 	if wso.Pod != nil {
// 		if wso.Events == nil && wso.Pod != nil {
// 			events, err := m.RawClient.CoreV1().Events(m.Config.Namespace).Search(scheme, wso.Pod)
// 			if err != nil {
// 				return xerrors.Errorf("completeWorkspaceObjects: %w", err)
// 			}

// 			wso.Events = make([]corev1.Event, len(events.Items))
// 			copy(wso.Events, events.Items)
// 		}
// 	}

// 	return nil
// }

func getWorkspaceStatus(wso workspaceObjects) (*workspacev1.WorkspaceStatus, error) {
	if wso.Workspace == nil {
		return nil, xerrors.Errorf("missing workspace object")
	}

	res := wso.Workspace.DeepCopy()

	id, ok := wso.WorkspaceID()
	if !ok {
		return nil, xerrors.Errorf("cannot get workspaceID")
	}

	// we have a workspace pod - use that to compute the status from scratch
	workspaceContainer := getContainer(wso.Pod, "workspace")
	if workspaceContainer == nil {
		return nil, xerrors.Errorf("workspace pod for %s is degenerate - does not have workspace container", id)
	}

	wsurl := wso.Workspace.Spec.Orchestration.URL
	if wsurl == "" {
		return nil, xerrors.Errorf("workspace %s has no URL", wso.Workspace.Name)
	}

	status := &res.Status
	err := extractStatusFromPod(status, wso)
	if err != nil {
		return nil, xerrors.Errorf("cannot get workspace status: %w", err)
	}

	var exposedPorts []workspacev1.PortStatus
	if wso.PortsService != nil {
		service := wso.PortsService

		for _, p := range service.Spec.Ports {
			port := workspacev1.PortStatus{
				Port:       uint32(p.Port),
				Target:     uint32(p.TargetPort.IntValue()),
				Visibility: portNameToVisibility(p.Name),
				Url:        service.Annotations[fmt.Sprintf("gitpod/port-url-%d", p.Port)],
			}

			// enforce the cannonical form where target defaults to port
			if port.Port == port.Target {
				port.Target = 0
			}

			exposedPorts = append(exposedPorts, port)
		}
	}
	status.Ports = exposedPorts

	var serviceExists *bool
	if wso.TheiaService != nil || wso.PortsService != nil {
		serviceExists = pointer.Bool(true)
	} else {
		serviceExists = pointer.Bool(false)
	}
	status.Conditions.ServiceExists = serviceExists

	if wso.Pod == nil {
		status.Conditions.Deployed = pointer.Bool(false)
	} else {
		status.Conditions.Deployed = pointer.Bool(true)
	}

	return status, nil
}

// portNameToVisibility parses the port name with the pattern defined in PortSpecToName and return the ports visibility (or default value if not specified)
func portNameToVisibility(s string) workspacev1.AdmissionLevel {
	parts := strings.Split(s, "-")
	if len(parts) != 2 {
		// old or wrong port name: return default
		return workspacev1.AdmissionOwnerOnly
	}

	// parse (or public as fallback: important for backwards compatibility during rollout)
	visibilitStr := fmt.Sprintf("PORT_VISIBILITY_%s", strings.ToUpper(parts[1]))
	i32Value, present := api.PortVisibility_value[visibilitStr]
	if !present {
		return workspacev1.AdmissionOwnerOnly
	}

	v := api.PortVisibility(i32Value)
	switch v {
	case api.PortVisibility_PORT_VISIBILITY_PRIVATE:
		return workspacev1.AdmissionOwnerOnly
	case api.PortVisibility_PORT_VISIBILITY_PUBLIC:
		return workspacev1.AdmissionEveryone
	default:
		return workspacev1.AdmissionOwnerOnly
	}
}

func getContainer(pod *corev1.Pod, name string) *corev1.Container {
	for _, c := range pod.Spec.Containers {
		if c.Name == name {
			return &c
		}
	}
	return nil
}

func extractStatusFromPod(result *workspacev1.WorkspaceStatus, wso workspaceObjects) error {
	pod := wso.Pod
	if pod == nil {
		return nil
	}

	// check failure states, i.e. determine value of result.Failed
	failure, phase := extractFailure(wso)
	result.Conditions.Failed = failure
	if phase != nil {
		result.Phase = workspacev1.Phase(*phase)
		return nil
	}
	if wso.IsWorkspaceHeadless() {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Terminated != nil && cs.State.Terminated.Message != "" {
				result.Conditions.HeadlessTaskFailed = cs.State.Terminated.Message
				break
			}
		}
	}

	if isPodBeingDeleted(pod) {
		result.Phase = workspacev1.PhaseStopping

		if !wso.Workspace.Status.Control.FailedBeforeStopping {
			// While the pod is being deleted we do not care or want to know about any failure state.
			// If the pod got stopped because it failed we will have sent out a Stopping status with a "failure"
			result.Conditions.Failed = ""
		}

		var hasFinalizer bool
		for _, f := range wso.Pod.Finalizers {
			if f == "gitpod.io/finalizer" {
				hasFinalizer = true
				break
			}
		}
		if !hasFinalizer {
			// We do this independently of the dispostal status because pods only get their finalizer
			// once they're running. If they fail before they reach the running phase we'll never see
			// a disposal status, hence would never stop the workspace.
			result.Phase = workspacev1.PhaseStopped
		}

		return nil
	}

	status := pod.Status
	if status.Phase == corev1.PodPending {
		// check if any container is still pulling images
		for _, cs := range status.ContainerStatuses {
			if cs.State.Waiting != nil {
				if cs.State.Waiting.Reason != "ContainerCreating" {
					continue
				}

				if wso.WasEverReady() {
					// Workspace was ready at some point but has become unready. This should never happen due to the
					// very conservative readiness probe. If it does happen however, we don't want to fall back to a
					// creating phase.
					log.WithField("pod", pod).Warn("once ready pod became unready - this should not happen")
					continue
				}

				result.Phase = workspacev1.PhaseCreating
				result.Conditions.PullingImages = pointer.Bool(true)
				result.Message = "containers are being created"
				return nil
			}
		}

		result.Phase = workspacev1.PhasePending
		result.Message = "pod is pending"
		return nil
	} else if status.Phase == corev1.PodRunning {
		for _, cs := range status.ContainerStatuses {
			// containers that were terminated are not ready, but may have been
			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode == containerUnknownExitCode {
				// the container was stopped for an unknown reason.
				// this means that the workspace is currently interrupted.
				result.Phase = workspacev1.PhaseInterrupted

				// was it caused by a network outage?
				if hasNetworkNotReadyEvent(wso) {
					// this might be a false positive in case the workspace recovers but has an exit code 255 for
					// another reason afterwards. As of now we're lagging the data to handle it better.
					result.Conditions.NetworkNotReady = pointer.Bool(true)
					result.Message = "container network not ready - workspace should recover shortly"
				} else {
					result.Message = fmt.Sprintf("container %s was terminated unexpectedly - workspace should recover", cs.Name)
				}

				return nil
			}

			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode == containerKilledExitCode {
				// we have a container which was killed with exit code 137 recently and is (hopefully) restarting at the moment.
				// this means that the workspace is currently interrupted.
				result.Phase = workspacev1.PhaseInterrupted
				result.Message = fmt.Sprintf("container %s was terminated unexpectedly - workspace should recover", cs.Name)
				return nil
			}

			if !cs.Ready && cs.RestartCount > 0 {
				// this container was running before, but is currently recovering from an interruption
				result.Phase = workspacev1.PhaseInterrupted
				result.Message = fmt.Sprintf("container %s was terminated unexpectedly - workspace is recovering", cs.Name)
				return nil
			}

			if !wso.Workspace.Status.Control.WasEverReady && !cs.Ready {
				// container isn't ready yet (never has been), thus we're still in the creating phase.
				result.Phase = workspacev1.PhaseCreating
				result.Message = "containers are starting"
				result.Conditions.PullingImages = pointer.Bool(false)
				return nil
			}
		}

		tpe, err := wso.WorkspaceType()
		if err != nil {
			log.WithError(err).Warn("cannot determine workspace type - assuming this is a regular")
			tpe = api.WorkspaceType_REGULAR
		}

		if wso.IsWorkspaceHeadless() && tpe != api.WorkspaceType_PREBUILD {
			// headless workspaces (except prebuilds) don't expose a public service and thus cannot be asked about their status.
			// once kubernetes reports the workspace running, so do we.
			result.Phase = workspacev1.PhaseRunning
			return nil
		}

		if wso.Workspace.Status.Control.WasEverReady {
			// workspcae has been marked ready by a workspace-ready probe of the monitor
			result.Phase = workspacev1.PhaseRunning
			return nil
		}

		// workspace has not yet been marked ready by one of monitor's probes. It must be initializing then.
		result.Phase = workspacev1.PhaseInitializing
		result.Message = "workspace initializer is running"
		return nil
	} else if isCompletedHeadless(&wso) {
		result.Phase = workspacev1.PhaseStopping
		result.Message = "headless workspace is stopping"
		return nil
	} else if status.Phase == corev1.PodUnknown {
		result.Phase = workspacev1.PhaseUnknown
		result.Message = "Kubernetes reports workspace phase as unknown"
		return nil
	}

	// If we've extracted a failure reason earlier, but no explicit phase at the time, as well as in this
	// function, we resort to unknown.
	// This is different to being unable to determine the workspace phase - the phase is unknown due to an unknown failure (by definition).
	if failure != "" {
		result.Phase = workspacev1.PhaseUnknown
		return nil
	}

	log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithField("pod", pod).Debug("cannot determine workspace phase")
	result.Phase = workspacev1.PhaseUnknown
	result.Message = "cannot determine workspace phase. We should never get here."
	return nil
}

// extractFailure returns a pod failure reason and possibly a phase. If phase is nil then
// one should extract the phase themselves. If the pod has not failed, this function returns "", nil.
func extractFailure(wso workspaceObjects) (string, *workspacev1.Phase) {
	pod := wso.Pod

	// if the workspace was explicitely marked as failed that also constitutes a failure reason
	if reason := wso.Workspace.Status.Conditions.Failed; reason != "" {
		return reason, nil
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
				// If the image pull failed we were definitely in the workspacev1.PhaseCreating phase,
				// unless of course this pod has been deleted already.
				var res *workspacev1.Phase
				if isPodBeingDeleted(pod) {
					// The pod is being deleted already and we have to decide the phase based on the presence of the
					// finalizer and disposal status annotation. That code already exists in the remainder of getStatus,
					// hence we defer the decision.
					res = nil
				} else {
					c := workspacev1.PhaseCreating
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
				var phase *workspacev1.Phase
				if !isPodBeingDeleted(pod) {
					// If the wrote a termination message and is not currently being deleted,
					// then it must have been/be running. If we did not force the phase here,
					// we'd be in unknown.
					c := workspacev1.PhaseRunning
					phase = &c
				}

				// the container itself told us why it was terminated - use that as failure reason
				return extractFailureFromLogs([]byte(terminationState.Message)), phase
			} else if terminationState.Reason == "Error" {
				if !isPodBeingDeleted(pod) && terminationState.ExitCode != containerKilledExitCode {
					phase := workspacev1.PhaseRunning
					return fmt.Sprintf("container %s ran with an error: exit code %d", cs.Name, terminationState.ExitCode), &phase
				}
			} else if terminationState.Reason == "Completed" {
				if wso.IsWorkspaceHeadless() {
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
				res := workspacev1.PhaseUnknown
				return fmt.Sprintf("workspace container %s terminated for an unknown reason: (%s) %s", cs.Name, terminationState.Reason, terminationState.Message), &res
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

// isCompletedHeadless returns true if the pod is a headless workspace and either succeeded or failed (e.g., ran to completion)
func isCompletedHeadless(wso *workspaceObjects) bool {
	return wso.IsWorkspaceHeadless() && (wso.Pod.Status.Phase == corev1.PodSucceeded || wso.Pod.Status.Phase == corev1.PodFailed)
}

// type activity string

// const (
// 	activityInit               activity = "initialization"
// 	activityStartup            activity = "startup"
// 	activityCreatingContainers activity = "creating containers"
// 	activityPullingImages      activity = "pulling images"
// 	activityRunningHeadless    activity = "running the headless workspace"
// 	activityNone               activity = "period of inactivity"
// 	activityClosed             activity = "after being closed"
// 	activityInterrupted        activity = "workspace interruption"
// 	activityStopping           activity = "stopping"
// 	activityBackup             activity = "backup"
// )

// isWorkspaceTimedOut determines if a workspace is timed out based on the manager configuration and state the pod is in.
// This function does NOT use the workspaceTimedoutAnnotation, but rather is used to set that annotation in the first place.
// func isWorkspaceTimedOut(wso workspaceObjects) (reason string, err error) {
// 	workspaceID, ok := wso.WorkspaceID()
// 	if !ok {
// 		return "", xerrors.Errorf("workspace has no %s annotation", workspaceIDAnnotation)
// 	}

// 	status, err := m.getWorkspaceStatus(wso)
// 	if err != nil {
// 		return "", xerrors.Errorf("cannot determine workspace phase: %w", err)
// 	}
// 	phase := status.Phase

// 	decide := func(start time.Time, timeout util.Duration, activity activity) (string, error) {
// 		td := time.Duration(timeout)
// 		inactivity := time.Since(start)
// 		if inactivity < td {
// 			return "", nil
// 		}

// 		return fmt.Sprintf("workspace timed out after %s (%s) took longer than %s", activity, formatDuration(inactivity), formatDuration(td)), nil
// 	}

// 	start := wso.Pod.ObjectMeta.CreationTimestamp.Time
// 	lastActivity := m.getWorkspaceActivity(workspaceID)
// 	_, isClosed := wso.Pod.Annotations[workspaceClosedAnnotation]

// 	switch phase {
// 	case workspacev1.Phase_PENDING:
// 		return decide(start, m.Config.Timeouts.Initialization, activityInit)

// 	case workspacev1.Phase_INITIALIZING:
// 		return decide(start, m.Config.Timeouts.TotalStartup, activityStartup)

// 	case workspacev1.PhaseCreating:
// 		activity := activityCreatingContainers
// 		if status.Conditions.PullingImages == api.WorkspaceConditionBool_TRUE {
// 			activity = activityPullingImages
// 		}
// 		return decide(start, m.Config.Timeouts.TotalStartup, activity)

// 	case workspacev1.PhaseRunning:
// 		timeout := m.Config.Timeouts.RegularWorkspace
// 		activity := activityNone
// 		if wso.IsWorkspaceHeadless() {
// 			timeout = m.Config.Timeouts.HeadlessWorkspace
// 			lastActivity = &start
// 			activity = activityRunningHeadless
// 		} else if lastActivity == nil {
// 			// the workspace is up and running, but the user has never produced any activity
// 			return decide(start, m.Config.Timeouts.TotalStartup, activityNone)
// 		} else if isClosed {
// 			return decide(*lastActivity, m.Config.Timeouts.AfterClose, activityClosed)
// 		}
// 		if ctv, ok := wso.Pod.Annotations[customTimeoutAnnotation]; ok {
// 			if ct, err := time.ParseDuration(ctv); err == nil {
// 				timeout = util.Duration(ct)
// 			} else {
// 				log.WithError(err).WithField("customTimeout", ctv).WithFields(wsk8s.GetOWIFromObject(&wso.Pod.ObjectMeta)).Warn("pod had custom timeout annotation set, but could not parse its value. Defaulting to ws-manager config.")
// 			}
// 		}
// 		return decide(*lastActivity, timeout, activity)

// 	case workspacev1.Phase_INTERRUPTED:
// 		if lastActivity == nil {
// 			// the workspace is up and running, but the user has never produced any activity
// 			return decide(start, m.Config.Timeouts.Interrupted, activityInterrupted)
// 		}
// 		return decide(*lastActivity, m.Config.Timeouts.Interrupted, activityInterrupted)

// 	case workspacev1.Phase_STOPPING:
// 		if isPodBeingDeleted(wso.Pod) && status.Conditions.FinalBackupComplete != api.WorkspaceConditionBool_TRUE {
// 			// Beware: we apply the ContentFinalization timeout only to workspaces which are currently being deleted.
// 			//         We basically don't expect a workspace to be in content finalization before it's been deleted.
// 			return decide(wso.Pod.DeletionTimestamp.Time, m.Config.Timeouts.ContentFinalization, activityBackup)
// 		} else if !isPodBeingDeleted(wso.Pod) {
// 			// pods that have not been deleted have never timed out
// 			return "", nil
// 		} else {
// 			return decide(wso.Pod.DeletionTimestamp.Time, m.Config.Timeouts.Stopping, activityStopping)
// 		}

// 	default:
// 		// the only other phases we can be in is stopped which is pointless to time out
// 		return "", nil
// 	}
// }

// hasNetworkNotReadyEvent determines if a workspace experienced a network outage - now, or any time in the past - based on
// its kubernetes events
func hasNetworkNotReadyEvent(wso workspaceObjects) bool {
	for _, evt := range wso.Events {
		if evt.Reason == "NetworkNotReady" {
			return true
		}
	}
	return false
}

// func formatDuration(d time.Duration) string {
// 	d = d.Round(time.Minute)
// 	h := d / time.Hour
// 	d -= h * time.Hour
// 	m := d / time.Minute
// 	return fmt.Sprintf("%02dh%02dm", h, m)
// }
