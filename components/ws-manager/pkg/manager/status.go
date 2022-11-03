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

	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/protobuf/types/known/timestamppb"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
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
	Pod    *corev1.Pod    `json:"pod"`
	Events []corev1.Event `json:"events,omitempty"`
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
	if wso.Pod != nil {
		val, ok := wso.Pod.ObjectMeta.Labels[headlessLabel]
		return ok && val == "true"
	}
	return false
}

func (wso *workspaceObjects) WorkspaceType() (api.WorkspaceType, error) {
	var meta *metav1.ObjectMeta
	if wso.Pod != nil {
		meta = &wso.Pod.ObjectMeta
	} else {
		// we don't know anything about this pod - assume it's a regular pod
		return api.WorkspaceType_REGULAR, xerrors.Errorf("cannot determine pod type")
	}

	lbl, ok := meta.Labels[wsk8s.TypeLabel]
	if !ok {
		tpe := api.WorkspaceType_REGULAR
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

	return "", false
}

func (wso *workspaceObjects) WasEverReady() (res bool) {
	check := func(a map[string]string) bool {
		_, neverReady := a[workspaceNeverReadyAnnotation]
		return !neverReady
	}

	if wso.Pod != nil {
		return check(wso.Pod.Annotations)
	}

	// We assume the pod was ready by default, even if we have nothing to show for it.
	// The real world has shown that this produces the more favorable failure modes.
	return true
}

// HostName returns the name of the node this workspace is/was deployed to. If this workspace has never been deployed anywhere, HostName returns an empty string.
func (wso *workspaceObjects) NodeName() string {
	if wso.Pod == nil {
		return ""
	}
	if wso.Pod.Spec.NodeName != "" {
		return wso.Pod.Spec.NodeName
	}
	if res, ok := wso.Pod.Annotations[nodeNameAnnotation]; ok {
		return res
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
	if wso.Pod == nil {
		return xerrors.Errorf("completeWorkspaceObjects: need either pod or lifecycle independent state")
	}

	if wso.Events == nil {
		events, err := m.RawClient.CoreV1().Events(m.Config.Namespace).Search(scheme, wso.Pod)
		if err != nil {
			return xerrors.Errorf("completeWorkspaceObjects: %w", err)
		}

		wso.Events = make([]corev1.Event, len(events.Items))
		copy(wso.Events, events.Items)
	}

	return nil
}

func (m *Manager) getWorkspaceStatus(wso workspaceObjects) (*api.WorkspaceStatus, error) {
	id, ok := wso.WorkspaceID()
	if !ok {
		return nil, xerrors.Errorf("cannot get %s annotation from %s", workspaceIDAnnotation, wso.Pod.Name)
	}

	var status *api.WorkspaceStatus
	if wso.Pod == nil {
		return nil, xerrors.Errorf("need pod to compute status")
	}

	// we have a workspace pod - use that to compute the status from scratch
	workspaceContainer := getContainer(wso.Pod, "workspace")
	if workspaceContainer == nil {
		return nil, xerrors.Errorf("workspace pod for %s is degenerate - does not have workspace container", id)
	}

	wsurl, ok := wso.Pod.Annotations[kubernetes.WorkspaceURLAnnotation]
	if !ok {
		return nil, xerrors.Errorf("pod %s has no %s annotation", wso.Pod.Name, kubernetes.WorkspaceURLAnnotation)
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
		wsImage         = workspaceContainer.Image
		ideImage        string
		supervisorImage string
		ideImagesLayers []string
	)
	if ispec, ok := wso.Pod.Annotations[kubernetes.WorkspaceImageSpecAnnotation]; ok {
		spec, err := regapi.ImageSpecFromBase64(ispec)
		if err != nil {
			return nil, xerrors.Errorf("invalid image spec: %w", err)
		}
		wsImage = spec.BaseRef
		ideImage = spec.IdeRef
		supervisorImage = spec.SupervisorRef
		ideImagesLayers = spec.IdeLayerRef
	}

	ownerToken, ok := wso.Pod.Annotations[kubernetes.OwnerTokenAnnotation]
	if !ok {
		log.WithFields(wso.GetOWI()).Warn("pod has no owner token. is this a legacy pod?")
	}
	admission := api.AdmissionLevel_ADMIT_OWNER_ONLY
	if av, ok := api.AdmissionLevel_value[strings.ToUpper(wso.Pod.Annotations[kubernetes.WorkspaceAdmissionAnnotation])]; ok {
		admission = api.AdmissionLevel(av)
	}

	var volumeSnapshotStatus workspaceVolumeSnapshotStatus
	if rawVolumeSnapshotStatus, ok := wso.Pod.Annotations[pvcWorkspaceVolumeSnapshotAnnotation]; ok {
		err := json.Unmarshal([]byte(rawVolumeSnapshotStatus), &volumeSnapshotStatus)
		if err != nil {
			return nil, xerrors.Errorf("invalid volume snapshot status: %w", err)
		}
	}

	status = &api.WorkspaceStatus{
		Id:            id,
		StatusVersion: m.clock.Tick(),
		Metadata:      getWorkspaceMetadata(wso.Pod),
		Spec: &api.WorkspaceSpec{
			Headless:           wso.IsWorkspaceHeadless(),
			WorkspaceImage:     wsImage,
			DeprecatedIdeImage: ideImage,
			IdeImage: &api.IDEImage{
				WebRef:        ideImage,
				SupervisorRef: supervisorImage,
			},
			IdeImageLayers: ideImagesLayers,
			Url:            wsurl,
			Type:           tpe,
			Timeout:        timeout,
			Class:          wso.Pod.Labels[workspaceClassLabel],
		},
		Conditions: &api.WorkspaceConditions{
			Snapshot: wso.Pod.Annotations[workspaceSnapshotAnnotation],
			VolumeSnapshot: &api.VolumeSnapshotInfo{
				VolumeSnapshotName:   volumeSnapshotStatus.VolumeSnapshotName,
				VolumeSnapshotHandle: volumeSnapshotStatus.VolumeSnapshotHandle,
			},
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

	err = m.extractStatusFromPod(status, wso)
	if err != nil {
		return nil, xerrors.Errorf("cannot get workspace status: %w", err)
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
	started := timestamppb.New(pod.CreationTimestamp.Time)
	annotations := make(map[string]string)
	for k, v := range pod.Annotations {
		if !strings.HasPrefix(k, workspaceAnnotationPrefix) {
			continue
		}
		annotations[strings.TrimPrefix(k, workspaceAnnotationPrefix)] = v
	}
	return &api.WorkspaceMetadata{
		Owner:       pod.ObjectMeta.Labels[wsk8s.OwnerLabel],
		MetaId:      pod.ObjectMeta.Labels[wsk8s.MetaIDLabel],
		StartedAt:   started,
		Annotations: annotations,
	}
}

func (m *Manager) extractStatusFromPod(result *api.WorkspaceStatus, wso workspaceObjects) error {
	pod := wso.Pod

	result.Spec.ExposedPorts = extractExposedPorts(pod).Ports

	// check failure states, i.e. determine value of result.Failed
	failure, phase := extractFailure(wso, m.metrics)
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
	if _, sbr := pod.Annotations[stoppedByRequestAnnotation]; sbr {
		result.Conditions.StoppedByRequest = api.WorkspaceConditionBool_TRUE
	}
	if _, abr := pod.Annotations[abortRequestAnnotation]; abr {
		result.Conditions.Aborted = api.WorkspaceConditionBool_TRUE
	}
	if wso.IsWorkspaceHeadless() {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Terminated != nil && cs.State.Terminated.Message != "" {
				result.Conditions.HeadlessTaskFailed = cs.State.Terminated.Message
				break
			}
		}
	}

	// if ws-manager is still attempting to create workspace pod, keep status in pending
	// pod might get deleted several times if we cannot schedule it on the node
	if _, atc := pod.Annotations[attemptingToCreatePodAnnotation]; atc {
		result.Phase = api.WorkspacePhase_PENDING
		return nil
	}

	if isPodBeingDeleted(pod) {
		result.Phase = api.WorkspacePhase_STOPPING

		var hasFinalizer bool
		for _, f := range wso.Pod.Finalizers {
			if f == gitpodFinalizerName {
				hasFinalizer = true
				break
			}
		}
		if !hasFinalizer {
			// We do this independently of the dispostal status because pods only get their finalizer
			// once they're running. If they fail before they reach the running phase we'll never see
			// a disposal status, hence would never stop the workspace.
			result.Phase = api.WorkspacePhase_STOPPED
		}

		if rawDisposalStatus, ok := pod.Annotations[disposalStatusAnnotation]; ok {
			var ds workspaceDisposalStatus
			err := json.Unmarshal([]byte(rawDisposalStatus), &ds)
			if err != nil {
				return err
			}

			if ds.Status.IsDisposed() {
				if ds.BackupFailure == "" {
					result.Conditions.FinalBackupComplete = api.WorkspaceConditionBool_TRUE
				}

				// Finalizer or not - once the backup is complete we consider the pod stopped.
				// Once the finalizer is removed, there's no guarantee we see the pod again, because it might be
				// deleted too quickly for us to handle. Hence, we consider the workspace stoppped once the backup
				// is done, even though the finalizer might still be present.
				//
				// This runs the risk that a pod might still be present, but is considered stopped.
				result.Phase = api.WorkspacePhase_STOPPED
			}
			result.Repo = ds.GitStatus

			// if the final backup has failed we need to tell the world (if we haven't done so already)
			if ds.BackupFailure != "" && !strings.Contains(result.Conditions.Failed, "last backup failed") {
				if result.Conditions.Failed != "" {
					result.Conditions.Failed += "; "
				}
				result.Conditions.Failed += fmt.Sprintf("last backup failed: %s.", ds.BackupFailure)
			}
		}

		return nil
	}

	status := pod.Status
	if status.Phase == corev1.PodPending {
		// check if any container is still pulling images
		for _, cs := range status.ContainerStatuses {
			if cs.State.Waiting != nil {
				if cs.State.Waiting.Reason != "ContainerCreating" && cs.State.Waiting.Reason != "PodInitializing" {
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
			pt := timestamppb.New(t)
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
		}

		tpe, err := wso.WorkspaceType()
		if err != nil {
			log.WithError(err).Warn("cannot determine workspace type - assuming this is a regular")
			tpe = api.WorkspaceType_REGULAR
		}

		if wso.IsWorkspaceHeadless() && tpe != api.WorkspaceType_PREBUILD {
			// headless workspaces (except prebuilds) don't expose a public service and thus cannot be asked about their status.
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
	} else if isCompletedHeadless(&wso) {
		result.Phase = api.WorkspacePhase_STOPPING
		result.Message = "headless workspace is stopping"
		return nil
	} else if status.Phase == corev1.PodSucceeded {
		result.Phase = api.WorkspacePhase_STOPPING
		result.Message = "workspace is stopping"
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

	log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithField("pod", pod).Error("cannot determine workspace phase")
	result.Phase = api.WorkspacePhase_UNKNOWN
	result.Message = "cannot determine workspace phase. We should never get here."
	return nil
}

// extractFailure returns a pod failure reason and possibly a phase. If phase is nil then
// one should extract the phase themselves. If the pod has not failed, this function returns "", nil.
func extractFailure(wso workspaceObjects, metrics *metrics) (string, *api.WorkspacePhase) {
	pod := wso.Pod
	wsType := strings.ToUpper(pod.Labels[wsk8s.TypeLabel])
	wsClass := pod.Labels[workspaceClassLabel]

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
				var res *api.WorkspacePhase
				if isPodBeingDeleted(pod) {
					// The pod is being deleted already and we have to decide the phase based on the presence of the
					// finalizer and disposal status annotation. That code already exists in the remainder of getStatus,
					// hence we defer the decision.
					res = nil
				} else {
					c := api.WorkspacePhase_CREATING
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
				var phase *api.WorkspacePhase
				if !isPodBeingDeleted(pod) {
					// If the wrote a termination message and is not currently being deleted,
					// then it must have been/be running. If we did not force the phase here,
					// we'd be in unknown.
					c := api.WorkspacePhase_RUNNING
					phase = &c
				}

				// the container itself told us why it was terminated - use that as failure reason
				return extractFailureFromLogs([]byte(terminationState.Message)), phase
			} else if terminationState.Reason == "Error" {
				if !isPodBeingDeleted(pod) && terminationState.ExitCode != containerKilledExitCode {
					phase := api.WorkspacePhase_RUNNING
					return fmt.Sprintf("container %s ran with an error: exit code %d", cs.Name, terminationState.ExitCode), &phase
				}
			} else if terminationState.Reason == "Completed" {
				// container terminated successfully - this is not a failure
				if !isPodBeingDeleted(pod) {
					if metrics != nil && !wso.IsWorkspaceHeadless() {
						metrics.totalUnintentionalWorkspaceStopCounterVec.WithLabelValues(wsType, wsClass).Inc()
					}
				}
				return "", nil
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

		if strings.Contains(evt.Message, "MountVolume.MountDevice failed for volume") {
			// ref: https://github.com/gitpod-io/gitpod/issues/13353
			// ref: https://github.com/kubernetes-sigs/gcp-compute-persistent-disk-csi-driver/issues/608
			log.WithField("pod", pod.Name).Warnf("%s", evt.Message)
			if metrics != nil {
				metrics.totalMountDeviceFailedVec.WithLabelValues(wsType, wsClass).Inc()
			}
			return "", nil
		} else if strings.Contains(evt.Message, workspaceVolumeName) {
			// ref: https://github.com/gitpod-io/gitpod/issues/14032
			log.WithField("pod", pod.Name).Warnf("%s", evt.Message)
			if metrics != nil {
				metrics.totalCannotMountVolumeVec.WithLabelValues(wsType, wsClass).Inc()
			}
			return "", nil
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

// isPodBeingDeleted returns true if the pod is currently being deleted
func isPodBeingDeleted(pod *corev1.Pod) bool {
	// if the pod is being deleted the only marker we have is that the deletionTimestamp is set
	return pod.ObjectMeta.DeletionTimestamp != nil
}

// isCompletedHeadless returns true if the pod is a headless workspace and either succeeded or failed (e.g., ran to completion)
func isCompletedHeadless(wso *workspaceObjects) bool {
	return wso.IsWorkspaceHeadless() && (wso.Pod.Status.Phase == corev1.PodSucceeded || wso.Pod.Status.Phase == corev1.PodFailed)
}

type activity string

const (
	activityInit               activity = "initialization"
	activityStartup            activity = "startup"
	activityCreatingContainers activity = "creating containers"
	activityPullingImages      activity = "pulling images"
	activityRunningHeadless    activity = "running the headless workspace"
	activityNone               activity = "period of inactivity"
	activityMaxLifetime        activity = "maximum lifetime"
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

		return fmt.Sprintf("workspace timed out after %s (%s) took longer than %s", activity, formatDuration(inactivity), formatDuration(td)), nil
	}

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
		// First check is always for the max lifetime
		if msg, err := decide(start, m.Config.Timeouts.MaxLifetime, activityMaxLifetime); msg != "" {
			return msg, err
		}

		timeout := m.Config.Timeouts.RegularWorkspace
		activity := activityNone
		if wso.IsWorkspaceHeadless() {
			timeout = m.Config.Timeouts.HeadlessWorkspace
			lastActivity = &start
			activity = activityRunningHeadless
		} else if lastActivity == nil {
			// the workspace is up and running, but the user has never produced any activity
			return decide(start, m.Config.Timeouts.TotalStartup, activityNone)
		} else if isClosed {
			return decide(*lastActivity, m.Config.Timeouts.AfterClose, activityClosed)
		}
		if ctv, ok := wso.Pod.Annotations[customTimeoutAnnotation]; ok {
			if ct, err := time.ParseDuration(ctv); err == nil {
				timeout = util.Duration(ct)
			} else {
				log.WithError(err).WithField("customTimeout", ctv).WithFields(wsk8s.GetOWIFromObject(&wso.Pod.ObjectMeta)).Warn("pod had custom timeout annotation set, but could not parse its value. Defaulting to ws-manager config.")
			}
		}
		return decide(*lastActivity, timeout, activity)

	case api.WorkspacePhase_INTERRUPTED:
		if lastActivity == nil {
			// the workspace is up and running, but the user has never produced any activity
			return decide(start, m.Config.Timeouts.Interrupted, activityInterrupted)
		}
		return decide(*lastActivity, m.Config.Timeouts.Interrupted, activityInterrupted)

	case api.WorkspacePhase_STOPPING:
		if isPodBeingDeleted(wso.Pod) && status.Conditions.FinalBackupComplete != api.WorkspaceConditionBool_TRUE {
			// Beware: we apply the ContentFinalization timeout only to workspaces which are currently being deleted.
			//         We basically don't expect a workspace to be in content finalization before it's been deleted.
			return decide(wso.Pod.DeletionTimestamp.Time, m.Config.Timeouts.ContentFinalization, activityBackup)
		} else if !isPodBeingDeleted(wso.Pod) {
			// pods that have not been deleted have never timed out
			return "", nil
		} else {
			return decide(wso.Pod.DeletionTimestamp.Time, m.Config.Timeouts.Stopping, activityStopping)
		}

	default:
		// the only other phases we can be in is stopped which is pointless to time out
		return "", nil
	}
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
