// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-manager/api"

	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/retry"
)

const (
	// workspaceIDAnnotation is the annotation on the WS pod which contains the workspace ID
	workspaceIDAnnotation = "gitpod/id"

	// servicePrefixAnnotation is the annotation on the WS pod which contains the service prefix
	servicePrefixAnnotation = "gitpod/servicePrefix"

	// workspaceURLAnnotation is the annotation on the WS pod which contains the public workspace URL
	workspaceURLAnnotation = "gitpod/url"

	// workspaceNeverReadyAnnotation marks a workspace as having never been ready. It's the inverse of the former workspaceReadyAnnotation
	workspaceNeverReadyAnnotation = "gitpod/never-ready"

	// workspaceTimedOutAnnotation marks a workspae as timed out by the ws-manager
	workspaceTimedOutAnnotation = "gitpod/timedout"

	// workspaceClosedAnnotation marks a workspace as closed by the user - this affects the timeout of a workspace
	workspaceClosedAnnotation = "gitpod/closed"

	// workspaceExplicitFailAnnotation marks a workspace as failed because of some runtime reason, e.g. the task that ran in it failed (used for headless workspaces)
	workspaceExplicitFailAnnotation = "gitpod/explicitFail"

	// workspaceSnapshotAnnotation stores a workspace's snapshot if one was taken prior to shutdown
	workspaceSnapshotAnnotation = "gitpod/snapshot"

	// workspaceInitializerAnnotation contains the protobuf serialized initializer config in base64 encoding. We need to keep this around post-request
	// as we'll pass on the request to ws-daemon later in the workspace's lifecycle. This is not a configmap as we cannot create the map prior to the pod,
	// because then we would not know which configmaps to delete; we cannot create the map after the pod as then the pod could reach the state what the
	// configmap is needed, but isn't present yet.
	// According to the K8S documentation, storing "large" amounts of data in annotations is not an issue:
	//   https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/#attaching-metadata-to-objects
	workspaceInitializerAnnotation = "gitpod/contentInitializer"

	// workspaceImageSpecAnnotation contains the protobuf serialized image spec in base64 encoding. We need to keep this around post-request
	// to provide this information to the registry facade later in the workspace's lifecycle.
	workspaceImageSpecAnnotation = "gitpod/imageSpec"

	// workspaceFailedBeforeStoppingAnnotation marks a workspace as failed even before we tried
	// to stop it. We do not extract the failure state from this annotation, but just stabilize
	// the state computation.
	workspaceFailedBeforeStoppingAnnotation = "gitpod/failedBeforeStopping"

	// customTimeoutAnnotation configures the activity timeout of a workspace, i.e. the timeout a user experiences when not using an otherwise active workspace for some time.
	// This is handy if you want to prevent a workspace from timing out during lunch break.
	customTimeoutAnnotation = "gitpod/customTimeout"

	// firstUserActivityAnnotation marks a workspace woth the timestamp of first user activity in it
	firstUserActivityAnnotation = "gitpod/firstUserActivity"

	// fullWorkspaceBackupAnnotation is set on workspaces which operate using a full workspace backup
	fullWorkspaceBackupAnnotation = "gitpod/fullWorkspaceBackup"

	// ownerTokenAnnotation contains the owner token of the workspace
	ownerTokenAnnotation = "gitpod/ownerToken"

	// workspaceAdmissionAnnotation determines the user admission to a workspace, i.e. if it can be accessed by everyone without token
	workspaceAdmissionAnnotation = "gitpod/admission"

	// ingressPortsAnnotation holds the mapping workspace port -> allocated ingress port on kubernetes services
	ingressPortsAnnotation = "gitpod/ingressPorts"

	// withUsernamespaceAnnotation is set on workspaces which are wrapped in a user namespace (or have some form of user namespace support)
	// Beware: this annotation is duplicated/copied in ws-daemon
	withUsernamespaceAnnotation = "gitpod/withUsernamespace"
)

// markWorkspaceAsReady adds annotations to a workspace pod
func (m *Manager) markWorkspace(ctx context.Context, workspaceID string, annotations ...*annotation) error {
	// Retry on failure. Sometimes this doesn't work because of concurrent modification. The Kuberentes way is to just try again after waiting a bit.
	err := retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		pod, err := m.findWorkspacePod(ctx, workspaceID)
		if err != nil {
			return xerrors.Errorf("cannot find workspace %s: %w", workspaceID, err)
		}
		if pod == nil {
			return xerrors.Errorf("workspace %s does not exist", workspaceID)
		}

		for _, a := range annotations {
			a.Apply(pod.Annotations)

			// Optimization: if we're failing the workspace explicitly, we might as well add the workspaceFailedBeforeStoppingAnnotation
			// as well. If we didin't do this here, the monitor would do that for us down the road, but this way need one fewer modification
			// of the pod.
			if a.Name == workspaceExplicitFailAnnotation {
				pod.Annotations[workspaceFailedBeforeStoppingAnnotation] = "true"
			}
		}

		return m.Clientset.Update(ctx, pod)
	})
	if err != nil {
		an := make([]string, len(annotations))
		for i, a := range annotations {
			if a.Delete {
				an[i] = "-" + a.Name
			} else {
				an[i] = "+" + a.Name
			}
		}
		return xerrors.Errorf("cannot mark workspace %s with %v: %w", workspaceID, strings.Join(an, ", "), err)
	}

	return nil
}

func addMark(name, value string) *annotation {
	return &annotation{name, value, false}
}

func deleteMark(name string) *annotation {
	return &annotation{name, "", true}
}

// annotation is a piece of metadata added to a workspace
type annotation struct {
	Name   string
	Value  string
	Delete bool
}

func (a *annotation) Apply(dst map[string]string) (needsUpdate bool) {
	_, wasPresent := dst[a.Name]
	if a.Delete {
		needsUpdate = wasPresent
		delete(dst, a.Name)
	} else {
		needsUpdate = !wasPresent
		dst[a.Name] = a.Value
	}
	return
}

const (
	// plisConfigMapMember is the name of the data entry of pod lifecycle independent state in a config map
	plisDataAnnotation = "gitpod/plis"
)

// podLifecycleIndependentState (PLIS) stores all data we cannot store on the pod because it supersedes the lifecycle
// of a workspace pod. Examples include the backup state, as the pod may be stopped/deleted, but the backup may
// still be running.
//
// Beware: The pod lifecycle independent state is really a measure of last resort.
//         Before adding to this structure, talk to someone else and make sure there is no better way!
type podLifecycleIndependentState struct {
	FinalBackupComplete bool       `json:"finalBackupComplete,omitempty"`
	FinalBackupFailure  string     `json:"finalBackupFailure,omitempty"`
	StoppingSince       *time.Time `json:"stoppingSince,omitempty"`

	// LastPodStatus is the status we computed just before the workspace pod was deleted
	LastPodStatus *api.WorkspaceStatus `json:"lastPodStatus,omitempty"`
	// HostIP is the IP address of the node the workspace pod is/was deployed to
	HostIP string `json:"hostIP,omitempty"`
}

// patchPodLifecycleIndependentState updates the pod lifecycle independent state of a workspace by setting the
// non-zero values of the patch. Calling this function triggers a status update. This function is
// neither atomic, nor synchronized.
func (m *Manager) patchPodLifecycleIndependentState(ctx context.Context, workspaceID string, patch func(*podLifecycleIndependentState) (needsUpdate bool), annotations ...*annotation) (err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "patchPodLifecycleIndependentState")
	defer tracing.FinishSpan(span, &err)

	err = retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		ctx, cancel := context.WithTimeout(ctx, kubernetesOperationTimeout)
		defer cancel()

		var plisCfg corev1.ConfigMap
		err := m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: getPodLifecycleIndependentCfgMapName(workspaceID)}, &plisCfg)
		if isKubernetesObjNotFoundError(err) {
			return xerrors.Errorf("workspace %s has no pod lifecycle independent state", workspaceID)
		}
		if err != nil {
			return xerrors.Errorf("cannot retrieve pod lifecycle independent state: %w", err)
		}
		tracing.LogEvent(span, "k8s get done")

		needsUpdate := false
		if patch != nil {
			plis, err := unmarshalPodLifecycleIndependentState(&plisCfg)
			if err != nil {
				return xerrors.Errorf("patch pod lifecycle independent state: %w", err)
			}
			if plis == nil {
				plis = &podLifecycleIndependentState{}
			}
			tracing.LogEvent(span, "unmarshalling done")
			tracing.LogKV(span, "prePatchPLIS", plisCfg.Annotations[plisDataAnnotation])

			needsUpdate = patch(plis)
			tracing.LogEvent(span, "patch done")

			err = marshalPodLifecycleIndependentState(&plisCfg, plis)
			if err != nil {
				return xerrors.Errorf("patch lifecycle independent state: %w", err)
			}
			tracing.LogEvent(span, "marshalling done")
		}

		for _, a := range annotations {
			doUpdate := a.Apply(plisCfg.Annotations)
			needsUpdate = needsUpdate || doUpdate
		}

		if !needsUpdate {
			return nil
		}

		tracing.LogKV(span, "postPatchPLIS", plisCfg.Annotations[plisDataAnnotation])
		tracing.LogKV(span, "needsUpdate", "true")

		return m.Clientset.Update(ctx, &plisCfg)
	})

	if err != nil {
		return xerrors.Errorf("patch lifecycle independent state: %w", err)
	}
	tracing.LogEvent(span, "k8s update done")

	return nil
}

// unmarshalPodLifecycleIndependentState reads the podLifecycleIndependentState JSON from the config map and tries to unmarshal it
func unmarshalPodLifecycleIndependentState(cfg *corev1.ConfigMap) (*podLifecycleIndependentState, error) {
	if cfg == nil {
		// no config map => nothing to unmarshal
		return nil, nil
	}

	rawPLIS, ok := cfg.Annotations[plisDataAnnotation]
	if !ok {
		// there's nothing for us in this config map
		return nil, nil
	}

	var result podLifecycleIndependentState
	err := json.Unmarshal([]byte(rawPLIS), &result)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal pod lifecycle independent state: %w", err)
	}

	return &result, nil
}

// marshalPLIS takes a podLifecycleIndependentState instance and stores it in the config map
func marshalPodLifecycleIndependentState(dst *corev1.ConfigMap, plis *podLifecycleIndependentState) error {
	rawPLIS, err := json.Marshal(plis)
	if err != nil {
		return xerrors.Errorf("cannot marshal pod lifecycle independent state: %w")
	}

	// We're not putting the PLIS JSON in the config map data as that takes about 10x as long as storing it in an annotation.

	dst.Annotations[plisDataAnnotation] = string(rawPLIS)
	return nil
}
