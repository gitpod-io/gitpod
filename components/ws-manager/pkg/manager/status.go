// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/golang/protobuf/ptypes"

	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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

// Scheme is the default instance of runtime.Scheme to which types in the Kubernetes API are already registered.
// Inspired by https://github.com/kubernetes/kubernetes/blob/master/pkg/kubectl/scheme/scheme.go
var scheme = runtime.NewScheme()

// register the core schema
func init() {
	err := corev1.AddToScheme(scheme)
	if err != nil {
		log.WithError(err).Fatal("cannot register Kubernetes core schema - this should never happen")
	}
}

// workspaceObjects contains all Kubernetes objects required to compute the status of a workspace
type workspaceObjects struct {
	Pod          *corev1.Pod     `json:"pod"`
	TheiaService *corev1.Service `json:"theiaService,omitempty"`
	PortsService *corev1.Service `json:"portsService,omitempty"`
	Events       []corev1.Event  `json:"events,omitempty"`

	// PLIS is Pod Lifecycle Independent State which we use to store state if there's no more appropriate place.
	// This is really a last resort and should only be used if there really is no other means of storing the state.
	PLIS *corev1.ConfigMap `json:"plis,omitempty"`
}

// GetOWI produces the owner, workspace, instance tripple that we use for tracing and logging
func (wso *workspaceObjects) GetOWI() logrus.Fields {
	if wso.Pod != nil {
		return wsk8s.GetOWIFromObject(&wso.Pod.ObjectMeta)
	}
	if wso.PLIS != nil {
		return wsk8s.GetOWIFromObject(&wso.PLIS.ObjectMeta)
	}
	return logrus.Fields{}
}

// IsWorkspaceHeadless returns true if the workspace described by these objects is headless
func (wso *workspaceObjects) IsWorkspaceHeadless() bool {
	if wso.Pod != nil {
		val, ok := wso.Pod.ObjectMeta.Labels[headlessLabel]
		return ok && val == "true"
	}
	if wso.PLIS != nil {
		val, ok := wso.PLIS.ObjectMeta.Labels[headlessLabel]
		return ok && val == "true"
	}
	return false
}

func (wso *workspaceObjects) WorkspaceType() (api.WorkspaceType, error) {
	var meta *metav1.ObjectMeta
	if wso.Pod != nil {
		meta = &wso.Pod.ObjectMeta
	} else if wso.PLIS != nil {
		meta = &wso.PLIS.ObjectMeta
	} else {
		// we don't know anything about this pod - assume it's a regular pod
		return api.WorkspaceType_REGULAR, xerrors.Errorf("cannot determine pod type")
	}

	lbl, ok := meta.Labels[wsk8s.TypeLabel]
	if !ok {
		// LEGACY
		// this is a legacy pod without explicit workspace type. If it's headless it must be a prebuild, otherwise it's a regular workspace
		var tpe api.WorkspaceType
		if wso.IsWorkspaceHeadless() {
			tpe = api.WorkspaceType_PREBUILD
		} else {
			tpe = api.WorkspaceType_REGULAR
		}
		log.WithFields(wsk8s.GetOWIFromObject(meta)).WithField("workspaceType", tpe).Info("determining type of legacy pod")
		return tpe, nil
	}

	val, ok := api.WorkspaceType_value[strings.ToUpper(lbl)]
	if !ok {
		// pod has invalid type label - we assume it's a regular pod
		return api.WorkspaceType_REGULAR, xerrors.Errorf("pod has invalid type label: %s", lbl)
	}

	return api.WorkspaceType(val), nil
}

// WorkspaceID returns the ID of the workspace
func (wso *workspaceObjects) WorkspaceID() (id string, ok bool) {
	if wso.Pod != nil {
		r, ok := wso.Pod.Annotations[workspaceIDAnnotation]
		if ok {
			return r, true
		}
	}
	if wso.PLIS != nil {
		r, ok := wso.PLIS.Annotations[workspaceIDAnnotation]
		if ok {
			return r, true
		}
	}

	return "", false
}

func (wso *workspaceObjects) WasEverReady() (res bool) {
	const deprecatedWorkspaceReadyAnnotation = "gitpod/ready"

	check := func(a map[string]string) bool {
		// we may still have some legacy pods running that used the former deprecatedWorkspaceReadyAnnotation
		// If we see that flag we have to give that one precedence.
		if _, ok := a[deprecatedWorkspaceReadyAnnotation]; ok {
			return true
		}

		_, neverReady := a[workspaceNeverReadyAnnotation]
		return !neverReady
	}

	if wso.Pod != nil {
		return check(wso.Pod.Annotations)
	}
	if wso.PLIS != nil {
		return check(wso.PLIS.Annotations)
	}

	// We assume the pod was ready by default, even if we have nothing to show for it.
	// The real world has shown that this produces the more favorable failure modes.
	return true
}

// HostIP returns the IP of the node this workspace is/was deployed to. If this workspace has never been deployed anywhere, HostIP returns an empty string.
func (wso *workspaceObjects) HostIP() string {
	if wso.Pod != nil {
		return wso.Pod.Status.HostIP
	}
	if wso.PLIS != nil {
		plis, _ := unmarshalPodLifecycleIndependentState(wso.PLIS)
		if plis != nil {
			return plis.HostIP
		}
	}
	return ""
}

func (m *Manager) getWorkspaceObjects(ctx context.Context, pod *corev1.Pod) (*workspaceObjects, error) {
	wso := &workspaceObjects{Pod: pod}
	err := m.completeWorkspaceObjects(ctx, wso)
	if err != nil {
		return nil, xerrors.Errorf("getWorkspaceObjects: %w", err)
	}
	return wso, nil
}

// completeWorkspaceObjects finds the remaining Kubernetes objects based on the pod description
// or pod lifecycle indepedent state.
func (m *Manager) completeWorkspaceObjects(ctx context.Context, wso *workspaceObjects) error {
	if wso.Pod == nil && wso.PLIS == nil {
		return xerrors.Errorf("completeWorkspaceObjects: need either pod or lifecycle independent state")
	}

	// find pod if we're working on PLIS alone so far
	if wso.Pod == nil {
		workspaceID, ok := wso.PLIS.ObjectMeta.Annotations[workspaceIDAnnotation]
		if !ok {
			return xerrors.Errorf("cannot find %s annotation on %s", workspaceIDAnnotation, wso.PLIS.Name)
		}

		pod, err := m.findWorkspacePod(ctx, workspaceID)
		if err == nil {
			wso.Pod = pod
		}

		if !isKubernetesObjNotFoundError(err) && err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}
	}

	// find our service prefix to see if the services still exist
	servicePrefix := ""
	if wso.Pod != nil {
		servicePrefix = wso.Pod.Annotations[servicePrefixAnnotation]
	}
	if servicePrefix == "" && wso.PLIS != nil {
		servicePrefix = wso.PLIS.Annotations[servicePrefixAnnotation]
	}
	if servicePrefix == "" {
		return xerrors.Errorf("completeWorkspaceObjects: no service prefix found")
	}
	serviceClient := m.Clientset.CoreV1().Services(m.Config.Namespace)
	if wso.TheiaService == nil {
		service, err := serviceClient.Get(ctx, getTheiaServiceName(servicePrefix), metav1.GetOptions{})
		if err == nil {
			wso.TheiaService = service
		}

		if !isKubernetesObjNotFoundError(err) && err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}
	}
	if wso.PortsService == nil {
		service, err := serviceClient.Get(ctx, getPortsServiceName(servicePrefix), metav1.GetOptions{})
		if err == nil {
			wso.PortsService = service
		}

		if !isKubernetesObjNotFoundError(err) && err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}
	}

	// find pod events - this only makes sense if we still have a pod
	if wso.Pod != nil {
		if wso.Events == nil && wso.Pod != nil {
			events, err := m.Clientset.CoreV1().Events(m.Config.Namespace).Search(scheme, wso.Pod)
			if err != nil {
				return xerrors.Errorf("completeWorkspaceObjects: %w", err)
			}

			wso.Events = make([]corev1.Event, len(events.Items))
			copy(wso.Events, events.Items)
		}
	}

	// if we don't have PLIS but a pod, try and find the PLIS
	if wso.PLIS == nil {
		workspaceID, ok := wso.Pod.Annotations[workspaceIDAnnotation]
		if !ok {
			return fmt.Errorf("cannot act on pod %s: has no %s annotation", wso.Pod.Name, workspaceIDAnnotation)
		}

		plis, err := m.Clientset.CoreV1().ConfigMaps(m.Config.Namespace).Get(ctx, getPodLifecycleIndependentCfgMapName(workspaceID), metav1.GetOptions{})
		if !isKubernetesObjNotFoundError(err) && err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}

		wso.PLIS = plis
	}

	return nil
}

func getPodLifecycleIndependentCfgMapName(workspaceID string) string {
	return fmt.Sprintf("plis-%s", workspaceID)
}

func (m *Manager) getWorkspaceStatus(wso workspaceObjects) (*api.WorkspaceStatus, error) {
	id, ok := wso.WorkspaceID()
	if !ok {
		return nil, xerrors.Errorf("cannot get %s annotation from %s", workspaceIDAnnotation, wso.Pod.Name)
	}

	var status *api.WorkspaceStatus
	if wso.Pod == nil {
		// Status computation depends heavily on the workspace pod, as that pod contains the better part of our
		// configuration and status. It is possible that we do not have a pod yet/anymore and have to rely on the
		// pod lifecycle independent state to come up with our status.
		//
		// In that case we fall back to some reduced status computation which uses the PLIS only.

		var err error
		status, err = m.getWorkspaceStatusFromPLIS(wso)
		if err != nil {
			return nil, err
		}
	} else {
		// we have a workspace pod - use that to compute the status from scratch (as compared to pulling it out of the PLIS alone)
		workspaceContainer := getContainer(wso.Pod, "workspace")
		if workspaceContainer == nil {
			return nil, xerrors.Errorf("workspace pod for %s is degenerate - does not have workspace container", id)
		}

		wsurl, ok := wso.Pod.Annotations[workspaceURLAnnotation]
		if !ok {
			return nil, xerrors.Errorf("pod %s has no %s annotation", wso.Pod.Name, workspaceURLAnnotation)
		}

		tpe, err := wso.WorkspaceType()
		if err != nil {
			return nil, err
		}

		var timeout string
		if t := m.Config.Timeouts.RegularWorkspace; t > 0 {
			timeout = t.String()
		}
		if v, ok := wso.Pod.Annotations[customTimeoutAnnotation]; ok {
			timeout = v
		}

		var (
			wsImage  = workspaceContainer.Image
			ideImage string
		)
		if ispec, ok := wso.Pod.Annotations[workspaceImageSpecAnnotation]; ok {
			spec, err := regapi.ImageSpecFromBase64(ispec)
			if err != nil {
				return nil, xerrors.Errorf("invalid iamge spec: %w", err)
			}
			wsImage = spec.BaseRef
			ideImage = spec.IdeRef
		}

		ownerToken, ok := wso.Pod.Annotations[ownerTokenAnnotation]
		if !ok {
			log.WithFields(wso.GetOWI()).Warn("pod has no owner token. is this a legacy pod?")
		}
		admission := api.AdmissionLevel_ADMIT_OWNER_ONLY
		if av, ok := api.AdmissionLevel_value[strings.ToUpper(wso.Pod.Annotations[workspaceAdmissionAnnotation])]; ok {
			admission = api.AdmissionLevel(av)
		}

		status = &api.WorkspaceStatus{
			Id:       id,
			Metadata: getWorkspaceMetadata(wso.Pod),
			Spec: &api.WorkspaceSpec{
				Headless:       wso.IsWorkspaceHeadless(),
				WorkspaceImage: wsImage,
				IdeImage:       ideImage,
				Url:            wsurl,
				Type:           tpe,
				Timeout:        timeout,
			},
			Conditions: &api.WorkspaceConditions{
				Snapshot: wso.Pod.Annotations[workspaceSnapshotAnnotation],
			},
			Runtime: &api.WorkspaceRuntimeInfo{
				NodeName: wso.Pod.Spec.NodeName,
				PodName:  wso.Pod.Name,
				NodeIp:   wso.Pod.Status.HostIP,
			},
			Auth: &api.WorkspaceAuthentication{
				Admission:  admission,
				OwnerToken: ownerToken,
			},
		}

		// pod first, plis later
		err = m.extractStatusFromPod(status, wso)
		if err != nil {
			return nil, xerrors.Errorf("cannot get workspace status: %w", err)
		}

		if wso.PLIS != nil {
			plis, err := unmarshalPodLifecycleIndependentState(wso.PLIS)
			if err != nil {
				return nil, xerrors.Errorf("cannot get workspace status: %w", err)
			}

			err = extractStatusFromPLIS(status, &wso, plis)
			if err != nil {
				return nil, xerrors.Errorf("cannot get workspace status: %w", err)
			}
		}
	}

	exposedPorts := []*api.PortSpec{}
	if wso.PortsService != nil {
		service := wso.PortsService

		for _, p := range service.Spec.Ports {
			port := &api.PortSpec{
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
	status.Spec.ExposedPorts = exposedPorts

	var serviceExists api.WorkspaceConditionBool
	if wso.TheiaService != nil || wso.PortsService != nil {
		serviceExists = api.WorkspaceConditionBool_TRUE
	} else {
		serviceExists = api.WorkspaceConditionBool_FALSE
	}
	status.Conditions.ServiceExists = serviceExists

	if wso.Pod == nil {
		status.Conditions.Deployed = api.WorkspaceConditionBool_FALSE
	} else {
		status.Conditions.Deployed = api.WorkspaceConditionBool_TRUE
	}

	return status, nil
}

func getContainer(pod *corev1.Pod, name string) *corev1.Container {
	for _, c := range pod.Spec.Containers {
		if c.Name == name {
			return &c
		}
	}
	return nil
}

// getWorkspaceMetadata extracts a workspace's metadata from pod labels
func getWorkspaceMetadata(pod *corev1.Pod) *api.WorkspaceMetadata {
	started, _ := ptypes.TimestampProto(pod.CreationTimestamp.Time)
	return &api.WorkspaceMetadata{
		Owner:     pod.ObjectMeta.Labels[wsk8s.OwnerLabel],
		MetaId:    pod.ObjectMeta.Labels[wsk8s.MetaIDLabel],
		StartedAt: started,
	}
}

func (m *Manager) extractStatusFromPod(result *api.WorkspaceStatus, wso workspaceObjects) error {
	pod := wso.Pod

	// check failure states, i.e. determine value of result.Failed
	failure, phase := extractFailure(wso)
	result.Conditions.Failed = failure
	if phase != nil {
		result.Phase = *phase
		return nil
	}
	if reason, timedout := pod.Annotations[workspaceTimedOutAnnotation]; timedout {
		if reason == "" {
			reason = "workspace timed out for an unknown reason"
		}
		result.Conditions.Timeout = reason
	}

	if isPodBeingDeleted(pod) {
		result.Phase = api.WorkspacePhase_STOPPING

		_, podFailedBeforeBeingStopped := pod.Annotations[workspaceFailedBeforeStoppingAnnotation]
		if !podFailedBeforeBeingStopped {
			// While the pod is being deleted we do not care or want to know about any failure state.
			// If the pod got stopped because it failed we will have sent out a Stopping status with a "failure"
			result.Conditions.Failed = ""
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

				result.Phase = api.WorkspacePhase_CREATING
				result.Conditions.PullingImages = api.WorkspaceConditionBool_TRUE
				result.Message = "containers are being created"
				return nil
			}
		}

		result.Phase = api.WorkspacePhase_PENDING
		result.Message = "pod is pending"
		return nil
	} else if status.Phase == corev1.PodRunning {
		if firstUserActivity, ok := wso.Pod.Annotations[firstUserActivityAnnotation]; ok {
			t, err := time.Parse(time.RFC3339Nano, firstUserActivity)
			if err != nil {
				return xerrors.Errorf("cannot parse firstUserActivity: %w", err)
			}
			pt, err := ptypes.TimestampProto(t)
			if err != nil {
				return xerrors.Errorf("cannot convert firstUserActivity: %w", err)
			}
			result.Conditions.FirstUserActivity = pt
		}

		for _, cs := range status.ContainerStatuses {
			// containers that were terminated are not ready, but may have been
			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode == containerUnknownExitCode {
				// the container was stopped for an unknown reason.
				// this means that the workspace is currently interrupted.
				result.Phase = api.WorkspacePhase_INTERRUPTED

				// was it caused by a network outage?
				if hasNetworkNotReadyEvent(wso) {
					// this might be a false positive in case the workspace recovers but has an exit code 255 for
					// another reason afterwards. As of now we're lagging the data to handle it better.
					result.Conditions.NetworkNotReady = api.WorkspaceConditionBool_TRUE
					result.Message = "container network not ready - workspace should recover shortly"
				} else {
					result.Message = fmt.Sprintf("container %s was terminated unexpectedly - workspace should recover", cs.Name)
				}

				return nil
			}

			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode == containerKilledExitCode {
				// we have a container which was killed with exit code 137 recently and is (hopefully) restarting at the moment.
				// this means that the workspace is currently interrupted.
				result.Phase = api.WorkspacePhase_INTERRUPTED
				result.Message = fmt.Sprintf("container %s was terminated unexpectedly - workspace should recover", cs.Name)
				return nil
			}

			if !cs.Ready && cs.RestartCount > 0 {
				// this container was running before, but is currently recovering from an interruption
				result.Phase = api.WorkspacePhase_INTERRUPTED
				result.Message = fmt.Sprintf("container %s was terminated unexpectedly - workspace is recovering", cs.Name)
				return nil
			}

			_, neverWereReady := pod.Annotations[workspaceNeverReadyAnnotation]
			if neverWereReady && !cs.Ready {
				// container isn't ready yet (never has been), thus we're still in the creating phase.
				result.Phase = api.WorkspacePhase_CREATING
				result.Message = "containers are starting"
				result.Conditions.PullingImages = api.WorkspaceConditionBool_FALSE
				return nil
			}
		}

		if wso.IsWorkspaceHeadless() {
			// headless workspaces don't expose a public service and thus cannot be asked about their status.
			// once kubernetes reports the workspace running, so do we.
			result.Phase = api.WorkspacePhase_RUNNING
			return nil
		}

		if _, neverReady := pod.Annotations[workspaceNeverReadyAnnotation]; !neverReady {
			// workspcae has been marked ready by a workspace-ready probe of the monitor
			result.Phase = api.WorkspacePhase_RUNNING
			return nil
		}

		// workspace has not yet been marked ready by one of monitor's probes. It must be initializing then.
		result.Phase = api.WorkspacePhase_INITIALIZING
		result.Message = "workspace initializer is running"
		return nil
	} else if status.Phase == corev1.PodUnknown {
		result.Phase = api.WorkspacePhase_UNKNOWN
		result.Message = "Kubernetes reports workspace phase as unknown"
		return nil
	}

	// If we've extracted a failure reason earlier, but no explicit phase at the time, as well as in this
	// function, we resort to unknown.
	// This is different to being unable to determine the workspace phase - the phase is unknown due to an unknown failure (by definition).
	if failure != "" {
		result.Phase = api.WorkspacePhase_UNKNOWN
		return nil
	}

	log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithField("pod", pod).Debug("cannot determine workspace phase")
	result.Phase = api.WorkspacePhase_UNKNOWN
	result.Message = "cannot determine workspace phase. We should never get here."
	return nil
}

// extractFailure returns a pod failure reason and possibly a phase. If phase is nil then
// one should extract the phase themselves. If the pod has not failed, this function returns "", nil.
func extractFailure(wso workspaceObjects) (string, *api.WorkspacePhase) {
	pod := wso.Pod

	// if the workspace was explicitely marked as failed that also constitutes a failure reason
	reason, explicitFailure := pod.Annotations[workspaceExplicitFailAnnotation]
	if explicitFailure {
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
				// If the image pull failed we were definitely in the api.WorkspacePhase_CREATING phase,
				// unless of course this pod has been deleted already.
				var res api.WorkspacePhase
				if isPodBeingDeleted(pod) {
					res = api.WorkspacePhase_STOPPING
				} else {
					res = api.WorkspacePhase_CREATING
				}
				return fmt.Sprintf("cannot pull image: %s", cs.State.Waiting.Message), &res
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
			if terminationState.Message != "" {
				// the container itself told us why it was terminated - use that as failure reason
				return extractFailureFromLogs([]byte(terminationState.Message)), nil
			} else if terminationState.Reason == "Error" {
				if !isPodBeingDeleted(pod) && terminationState.ExitCode != containerKilledExitCode {
					return fmt.Sprintf("container %s ran with an error: exit code %d", cs.Name, terminationState.ExitCode), nil
				}
			} else if terminationState.Reason == "Completed" {
				return fmt.Sprintf("container %s completed; containers of a workspace pod are not supposed to do that", cs.Name), nil
			} else if !isPodBeingDeleted(pod) && terminationState.ExitCode != containerUnknownExitCode {
				// if a container is terminated and it wasn't because of either:
				//  - regular shutdown
				//  - the exit code "UNKNOWN" (which might be caused by an intermittent issue and is handled in extractStatusFromPod)
				//  - another known error
				// then we report it as UNKNOWN
				res := api.WorkspacePhase_UNKNOWN
				return fmt.Sprintf("workspace container %s terminated for an unknown reason: (%s) %s", cs.Name, terminationState.Reason, terminationState.Message), &res
			}
		}
	}

	// some failure conditions are only evident from the "events" that kubernetes stores, e.g. events coming from the kubelet
	for _, evt := range wso.Events {
		if evt.Reason != "FailedMount" {
			continue
		}

		// ideally we do not just use evt.Message as failure reason because it contains internal paths and is not useful for the user
		if strings.Contains(evt.Message, theiaVolumeName) {
			return "cannot mount Theia", nil
		} else if strings.Contains(evt.Message, workspaceVolumeName) {
			return "cannot mount workspace", nil
		} else {
			// if this happens we did not do a good job because that means we've introduced another volume to the pod
			// but did not consider that mounting it might fail.
			return evt.Message, nil
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

// isPodBeingDeleted returns true if the pod is currently being stopped/deleted
func isPodBeingDeleted(pod *corev1.Pod) bool {
	// if the pod is being deleted the only marker we have is that the deletionTimestamp is set
	return pod.ObjectMeta.DeletionTimestamp != nil
}

type activity string

const (
	activityInit               activity = "initialization"
	activityStartup            activity = "startup"
	activityCreatingContainers activity = "creating containers"
	activityPullingImages      activity = "pulling images"
	activityRunningHeadless    activity = "running the headless workspace"
	activityNone               activity = "period of inactivity"
	activityClosed             activity = "after being closed"
	activityInterrupted        activity = "workspace interruption"
	activityStopping           activity = "stopping"
	activityBackup             activity = "backup"
)

// isWorkspaceTimedOut determines if a workspace is timed out based on the manager configuration and state the pod is in.
// This function does NOT use the workspaceTimedoutAnnotation, but rather is used to set that annotation in the first place.
func (m *Manager) isWorkspaceTimedOut(wso workspaceObjects) (reason string, err error) {
	workspaceID, ok := wso.WorkspaceID()
	if !ok {
		return "", xerrors.Errorf("workspace has no %s annotation", workspaceIDAnnotation)
	}

	status, err := m.getWorkspaceStatus(wso)
	if err != nil {
		return "", xerrors.Errorf("cannot determine workspace phase: %w", err)
	}
	phase := status.Phase

	decide := func(start time.Time, timeout util.Duration, activity activity) (string, error) {
		td := time.Duration(timeout)
		inactivity := time.Since(start)
		if inactivity < td {
			return "", nil
		}

		return fmt.Sprintf("workspace timed out after %s took longer than %s", activity, formatDuration(inactivity)), nil
	}

	if wso.Pod != nil {
		start := wso.Pod.ObjectMeta.CreationTimestamp.Time
		lastActivity := m.getWorkspaceActivity(workspaceID)
		_, isClosed := wso.Pod.Annotations[workspaceClosedAnnotation]

		switch phase {
		case api.WorkspacePhase_PENDING:
			return decide(start, m.Config.Timeouts.Initialization, activityInit)

		case api.WorkspacePhase_INITIALIZING:
			return decide(start, m.Config.Timeouts.TotalStartup, activityStartup)

		case api.WorkspacePhase_CREATING:
			activity := activityCreatingContainers
			if status.Conditions.PullingImages == api.WorkspaceConditionBool_TRUE {
				activity = activityPullingImages
			}
			return decide(start, m.Config.Timeouts.TotalStartup, activity)

		case api.WorkspacePhase_RUNNING:
			if wso.IsWorkspaceHeadless() {
				return decide(start, m.Config.Timeouts.HeadlessWorkspace, activityRunningHeadless)
			} else if lastActivity == nil {
				// the workspace is up and running, but the user has never produced any activity
				return decide(start, m.Config.Timeouts.TotalStartup, activityNone)
			} else if isClosed {
				return decide(*lastActivity, m.Config.Timeouts.AfterClose, activityClosed)
			}
			timeout := m.Config.Timeouts.RegularWorkspace
			if ctv, ok := wso.Pod.Annotations[customTimeoutAnnotation]; ok {
				if ct, err := time.ParseDuration(ctv); err != nil {
					log.WithError(err).WithField("customTimeout", ctv).WithFields(wsk8s.GetOWIFromObject(&wso.Pod.ObjectMeta)).Warn("pod had custom timeout annotation set, but could not parse its value. Defaulting to ws-manager config.")
					timeout = m.Config.Timeouts.RegularWorkspace
				} else {
					timeout = util.Duration(ct)
				}
			}
			return decide(*lastActivity, timeout, activityNone)

		case api.WorkspacePhase_INTERRUPTED:
			if lastActivity == nil {
				// the workspace is up and running, but the user has never produced any activity
				return decide(start, m.Config.Timeouts.Interrupted, activityInterrupted)
			}
			return decide(*lastActivity, m.Config.Timeouts.Interrupted, activityInterrupted)

		default:
			// the only other phases we can be in is stopping and stopped: we leave the stopping timeout to the PLIS branch and don't want to timeout when stopped
			return "", nil
		}
	} else if wso.PLIS != nil {
		plis, err := unmarshalPodLifecycleIndependentState(wso.PLIS)
		if err != nil {
			return "", xerrors.Errorf("cannot determine workspace timeout: %w", err)
		}
		if plis == nil {
			return "", xerrors.Errorf("cannot determine workspace timeout: we have neither pod nor pod lifecycle independent state")
		}

		switch phase {
		case api.WorkspacePhase_STOPPING:
			if plis.StoppingSince == nil {
				return "", xerrors.Errorf("cannot determine workspace timeout: we don't know when we started stopping")
			}
			activity := activityStopping
			if status.Conditions.FinalBackupComplete != api.WorkspaceConditionBool_TRUE {
				activity = activityBackup
			}
			return decide(*plis.StoppingSince, m.Config.Timeouts.Stopping, activity)

		case api.WorkspacePhase_STOPPED:
			return "", nil

		default:
			// if we end up here then somehow we've reached a state where we're neither stopping nor stopped, but also don't
			// have a pod. Dunno how this could ever happen.
			log.WithField("wso", wso).Error("cannot determine workspace timeout: we should never get here (TM)")
		}
	}

	return "", xerrors.Errorf("cannot determine workspace timeout: we have neither pod nor pod lifecycle independent state")
}

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

func formatDuration(d time.Duration) string {
	d = d.Round(time.Minute)
	h := d / time.Hour
	d -= h * time.Hour
	m := d / time.Minute
	return fmt.Sprintf("%02dh%02dm", h, m)
}

// errNoPLIS is returned by getWorkspaceStatusFromPLIS if the PLIS configMap is present, but
// does not contain a PLIS annotation.
var errNoPLIS = xerrors.Errorf("workspace has no pod lifecycle independent state")

// getWorkspaceStatusFromPLIS tries to compute the workspace status from the pod lifecycle independent state alone.
// For this to work the PLIS must be set and contain the last pod-based status.
func (m *Manager) getWorkspaceStatusFromPLIS(wso workspaceObjects) (*api.WorkspaceStatus, error) {
	if wso.PLIS == nil {
		return nil, xerrors.Errorf("workspace has no pod lifecycle independent state obj")
	}

	plis, err := unmarshalPodLifecycleIndependentState(wso.PLIS)
	if err != nil {
		return nil, xerrors.Errorf("cannot get status from pod lifecycle independent state: %w", err)
	}
	if plis == nil {
		return nil, errNoPLIS
	}

	if plis.LastPodStatus == nil {
		return nil, xerrors.Errorf("pod lifecycle independent state does not contain last pod-based status")
	}

	status := plis.LastPodStatus
	err = extractStatusFromPLIS(status, &wso, plis)
	if err != nil {
		return nil, xerrors.Errorf("cannot get status from pod lifecycle independent state: %w", err)
	}

	return status, nil
}

// extractStatusFromPLIS takes the information in the pod independent lifecycle and adds it to the status
func extractStatusFromPLIS(result *api.WorkspaceStatus, wso *workspaceObjects, plis *podLifecycleIndependentState) error {
	if plis == nil || wso.PLIS == nil {
		// no plis => nothing to extract
		return nil
	}

	if plis.FinalBackupComplete {
		result.Conditions.FinalBackupComplete = api.WorkspaceConditionBool_TRUE

		if wso.Pod == nil {
			// at this point the pod is gone and the final backup is complete, which means the workspace is finally stopped
			result.Phase = api.WorkspacePhase_STOPPED
		}
	}

	// if the final backup has failed we need to tell the world (if we haven't done so already)
	if plis.FinalBackupFailure != "" && !strings.Contains(result.Conditions.Failed, "last backup failed") {
		if result.Conditions.Failed != "" {
			result.Conditions.Failed += "; "
		}
		result.Conditions.Failed += fmt.Sprintf("last backup failed: %s. Please contact support if you need the workspace data.", plis.FinalBackupFailure)
	}

	// if the PLIS has a timeout annotation we must forward that to the conditions
	if timeout, ok := wso.PLIS.Annotations[workspaceTimedOutAnnotation]; result.Conditions.Timeout == "" && ok {
		result.Conditions.Timeout = timeout
	}

	return nil
}
