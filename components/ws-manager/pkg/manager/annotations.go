// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/util/wait"
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

	// workspaceFailedBeforeStoppingAnnotation marks a workspace as failed even before we tried
	// to stop it. We do not extract the failure state from this annotation, but just stabilize
	// the state computation.
	workspaceFailedBeforeStoppingAnnotation = "gitpod/failedBeforeStopping"

	// customTimeoutAnnotation configures the activity timeout of a workspace, i.e. the timeout a user experiences when not using an otherwise active workspace for some time.
	// This is handy if you want to prevent a workspace from timing out during lunch break.
	customTimeoutAnnotation = "gitpod/customTimeout"

	// firstUserActivityAnnotation marks a workspace woth the timestamp of first user activity in it
	firstUserActivityAnnotation = "gitpod/firstUserActivity"

	// pvcWorkspaceVolumeSnapshotAnnotation stores volume snapshot name when snapshot was created from pvc
	pvcWorkspaceVolumeSnapshotAnnotation = "gitpod.io/volumeSnapshotName"

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

	// abortRequestAnnotation is set if StopWorkspace was called with ABORT StopWorkspacePolicy
	abortRequestAnnotation = "gitpod.io/abortRequest"

	// attemptingToCreatePodAnnotation is set when ws-manager is trying to create pod and is removed when pod is successfully scheduled on the node
	attemptingToCreatePodAnnotation = "gitpod.io/attemptingToCreate"

	// alreadyInitializingAnnotation is set when initializing is done
	alreadyInitializingAnnotation = "gitpod.io/alreadyInitializing"
)

// markWorkspaceAsReady adds annotations to a workspace pod
func (m *Manager) markWorkspace(ctx context.Context, workspaceID string, annotations ...*annotation) error {
	// use custom backoff, as default one fails after 1.5s, this one will try for about 25s
	// we want to try harder to remove or add annotation, as failure to remove "gitpod/never-ready" annotation
	// would cause whole workspace to be marked as failed, hence the reason to try harder here.
	var backoff = wait.Backoff{
		Steps:    7,
		Duration: 100 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.1,
	}
	// Retry on failure. Sometimes this doesn't work because of concurrent modification. The Kuberentes way is to just try again after waiting a bit.
	err := retry.RetryOnConflict(backoff, func() error {
		sctx, cancel := context.WithTimeout(context.Background(), kubernetesOperationTimeout)
		defer cancel()

		pod, err := m.findWorkspacePod(sctx, workspaceID)
		if err != nil {
			if isKubernetesObjNotFoundError(err) {
				return nil
			}
			return fmt.Errorf("cannot mark workspace %s: %w", workspaceID, err)
		}
		if pod == nil {
			return fmt.Errorf("workspace %s does not exist", workspaceID)
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

		return m.Clientset.Update(sctx, pod)
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
	BackupFailure string           `json:"backupFailure,omitempty"`
	GitStatus     *csapi.GitStatus `json:"gitStatus,omitempty"`
	Status        DisposalStatus   `json:"status,omitempty"`
}

func (m *Manager) markDisposalStatus(ctx context.Context, workspaceID string, disposalStatus *workspaceDisposalStatus) error {
	b, err := json.Marshal(disposalStatus)
	if err != nil {
		return err
	}

	return m.markWorkspace(ctx, workspaceID, addMark(disposalStatusAnnotation, string(b)))
}

type DisposalStatus string

const (
	DisposalEmpty    DisposalStatus = ""
	DisposalStarted  DisposalStatus = "started"
	DisposalRetrying DisposalStatus = "retrying"
	DisposalFinished DisposalStatus = "finished"
)

func (ds DisposalStatus) IsDisposed() bool {
	return ds == DisposalFinished
}

// workspaceVolumeSnapshotStatus stores the status of volume snapshot
type workspaceVolumeSnapshotStatus struct {
	VolumeSnapshotName   string `json:"volumeSnapshotName,omitempty"`
	VolumeSnapshotHandle string `json:"volumeSnapshotHandle,omitempty"`
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
