// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"strings"

	"golang.org/x/xerrors"
	"k8s.io/client-go/util/retry"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
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

	// gitpodFinalizerName is the name of the Gitpod finalizer we use to clean up a workspace
	gitpodFinalizerName = "gitpod.io/finalizer"

	// disposalStatusAnnotation contains the status of the workspace disposal process
	disposalStatusAnnotation = "gitpod.io/disposalStatus"

	// nodeNameAnnotation contains the name of the node the pod ran on. We use this to remeber the name in case the pod gets evicted.
	nodeNameAnnotation = "gitpod.io/nodeName"

	// workspaceAnnotationPrefix prefixes pod annotations that contain annotations specified during the workspaces start request
	workspaceAnnotationPrefix = "gitpod.io/annotation."

	// stoppedByRequestAnnotation is set on a pod when it was requested to stop using a StopWorkspace call
	stoppedByRequestAnnotation = "gitpod.io/stoppedByRequest"
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

// workspaceDisposalStatus indicates the status of the workspace diposal
type workspaceDisposalStatus struct {
	BackupComplete bool             `json:"backupComplete,omitempty"`
	BackupFailure  string           `json:"backupFailure,omitempty"`
	GitStatus      *csapi.GitStatus `json:"gitStatus,omitempty"`
}

func (m *Manager) modifyFinalizer(ctx context.Context, workspaceID string, finalizer string, add bool) error {
	// Retry on failure. Sometimes this doesn't work because of concurrent modification. The Kuberentes way is to just try again after waiting a bit.
	return retry.RetryOnConflict(retry.DefaultBackoff, func() (err error) {
		span, ctx := tracing.FromContext(ctx, "modifyFinalizer")
		tracing.ApplyOWI(span, log.OWI("", "", workspaceID))
		defer tracing.FinishSpan(span, &err)
		span.LogKV("finalizer", finalizer, "add", add)

		pod, err := m.findWorkspacePod(ctx, workspaceID)
		if err != nil {
			if isKubernetesObjNotFoundError(err) {
				return nil
			}

			return xerrors.Errorf("unexpected error searching workspace %s: %w", workspaceID, err)
		}
		if pod == nil {
			return xerrors.Errorf("workspace %s does not exist", workspaceID)
		}

		var update bool
		if add {
			var exists bool
			for _, x := range pod.Finalizers {
				if x == gitpodFinalizerName {
					exists = true
					break
				}
			}
			if !exists {
				pod.Finalizers = append(pod.Finalizers, finalizer)
				update = true
			}
		} else {
			n := 0
			for _, x := range pod.Finalizers {
				if x == gitpodFinalizerName {
					update = true
				} else {
					pod.Finalizers[n] = x
					n++
				}
			}
			pod.Finalizers = pod.Finalizers[:n]
		}

		if !update {
			return nil
		}

		return m.Clientset.Update(ctx, pod)
	})
}
