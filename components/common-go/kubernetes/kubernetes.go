// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package kubernetes

// wsman and ws-scheduler need to share labels/annotations so that we can have consistent logging and tracing.
//
// Those two are the only cases where you would actually need this package. If you think you need this elsewhere,
// please make sure you're not better of using wsman's API to solve your problem. If this is actually what you need,
// please update this comment.
//

import (
	"context"
	"fmt"
	"math"

	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	// WorkspaceIDLabel is the label which contains the workspaceID. We duplicate this information with the annotations to make selection easier
	WorkspaceIDLabel = "workspaceID"

	// OwnerLabel is the label of the workspace's owner
	OwnerLabel = "owner"

	// MetaIDLabel is the label of the workspace meta ID (just workspace ID outside of wsman)
	MetaIDLabel = "metaID"

	// TypeLabel marks the workspace type
	TypeLabel = "workspaceType"

	// ServiceTypeLabel help differentiate between port service and IDE service
	ServiceTypeLabel = "serviceType"

	// GitpodDiskPressureLabel marks a node as having disk pressure (besides the root disk - used for the workspace SSDs, set by ws-daemon)
	GitpodDiskPressureLabel = "gitpod.io/diskPressure"

	// GitpodNodeServiceLabel marks a pod as providing a particular service to a node
	GitpodNodeServiceLabel = "gitpod.io/nodeService"

	// TraceIDAnnotation adds a Jaeger/OpenTracing header to the pod so that we can trace it's behaviour
	TraceIDAnnotation = "gitpod/traceid"

	// CPULimitAnnotation enforces a strict CPU limit on a workspace by virtue of ws-daemon
	CPULimitAnnotation = "gitpod/cpuLimit"

	// RequiredNodeServicesAnnotation lists all Gitpod services required on the node
	RequiredNodeServicesAnnotation = "gitpod.io/requiredNodeServices"

	// ContainerIsGoneAnnotation is used as workaround for containerd https://github.com/containerd/containerd/pull/4214
	// which might cause workspace container status propagation to fail, which in turn would keep a workspace running indefinitely.
	ContainerIsGoneAnnotation = "gitpod.io/containerIsGone"
)

// WorkspaceSupervisorEndpoint produces the supervisor endpoint of a workspace.
func WorkspaceSupervisorEndpoint(workspaceID, kubernetesNamespace string) string {
	return fmt.Sprintf("ws-%s-theia.%s.svc:22999", workspaceID, kubernetesNamespace)
}

// GetOWIFromObject finds the owner, workspace and instance information on a Kubernetes object using labels
func GetOWIFromObject(pod *metav1.ObjectMeta) logrus.Fields {
	owner := pod.Labels[OwnerLabel]
	workspace := pod.Labels[MetaIDLabel]
	instance := pod.Labels[WorkspaceIDLabel]
	return log.OWI(owner, workspace, instance)
}

// UnlimitedRateLimiter implements an emtpy, unlimited flowcontrol.RateLimiter
type UnlimitedRateLimiter struct {
}

// TryAccept returns true if a token is taken immediately. Otherwise,
// it returns false.
func (u *UnlimitedRateLimiter) TryAccept() bool {
	return true
}

// Accept returns once a token becomes available.
func (u *UnlimitedRateLimiter) Accept() {
}

// Stop stops the rate limiter, subsequent calls to CanAccept will return false
func (u *UnlimitedRateLimiter) Stop() {
}

// QPS returns QPS of this rate limiter
func (u *UnlimitedRateLimiter) QPS() float32 {
	return math.MaxFloat32
}

// Wait returns nil if a token is taken before the Context is done.
func (u *UnlimitedRateLimiter) Wait(ctx context.Context) error {
	return nil
}

func IsWorkspace(pod *corev1.Pod) bool {
	val, ok := pod.ObjectMeta.Labels["component"]
	return ok && val == "workspace"
}

func IsHeadlessWorkspace(pod *corev1.Pod) bool {
	if !IsWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels["headless"]
	return ok && val == "true"
}

func IsGhostWorkspace(pod *corev1.Pod) bool {
	if !IsWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels[TypeLabel]
	return ok && val == "ghost"
}

func IsRegularWorkspace(pod *corev1.Pod) bool {
	if !IsWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels[TypeLabel]
	return ok && val == "regular"
}

func IsNonGhostWorkspace(pod *corev1.Pod) bool {
	return IsWorkspace(pod) &&
		!IsGhostWorkspace(pod)
}

func GetWorkspaceType(pod *corev1.Pod) string {
	val, ok := pod.ObjectMeta.Labels[TypeLabel]
	if !ok {
		return ""
	}
	return val
}
