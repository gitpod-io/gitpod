// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package kubernetes

// Those two are the only cases where you would actually need this package. If you think you need this elsewhere,
// please make sure you're not better of using wsman's API to solve your problem. If this is actually what you need,
// please update this comment.
//

import (
	"context"
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

	// ProjectLabel is the label for the workspace's project
	ProjectLabel = "project"

	// TeamLabel is the label for the workspace's team
	TeamLabel = "team"

	// TypeLabel marks the workspace type
	TypeLabel = "workspaceType"

	// ServiceTypeLabel help differentiate between port service and IDE service
	ServiceTypeLabel = "serviceType"

	// WorkspaceManaged indicates which component is responsible for managing the workspace
	WorkspaceManagedByLabel = "gitpod.io/managed-by"

	// CPULimitAnnotation enforces a strict CPU limit on a workspace by virtue of ws-daemon
	CPULimitAnnotation = "gitpod.io/cpuLimit"

	// WorkspaceURLAnnotation is the annotation on the WS pod which contains the public workspace URL.
	WorkspaceURLAnnotation = "gitpod/url"

	// OwnerTokenAnnotation contains the owner token of the workspace.
	OwnerTokenAnnotation = "gitpod/ownerToken"

	// WorkspaceAdmissionAnnotation determines the user admission to a workspace, i.e. if it can be accessed by everyone without token.
	WorkspaceAdmissionAnnotation = "gitpod/admission"

	// WorkspaceImageSpecAnnotation contains the protobuf serialized image spec in base64 encoding. We need to keep this around post-request
	// to provide this information to the registry facade later in the workspace's lifecycle.
	WorkspaceImageSpecAnnotation = "gitpod/imageSpec"

	// WorkspaceExposedPorts contains the exposed ports in the workspace
	WorkspaceExposedPorts = "gitpod/exposedPorts"

	// WorkspaceSSHPublicKeys contains all authorized ssh public keys that can be connected to the workspace
	WorkspaceSSHPublicKeys = "gitpod.io/sshPublicKeys"

	// workspaceCpuMinLimitAnnotation denotes the minimum cpu limit of a workspace i.e. the minimum amount of resources it is guaranteed to get
	WorkspaceCpuMinLimitAnnotation = "gitpod.io/cpuMinLimit"

	// workspaceCpuBurstLimit denotes the cpu burst limit of a workspace
	WorkspaceCpuBurstLimitAnnotation = "gitpod.io/cpuBurstLimit"

	// workspaceNetConnLimit denotes the maximum number of connections a workspace can make per minute
	WorkspaceNetConnLimitAnnotation = "gitpod.io/netConnLimitPerMinute"

	// workspacePressureStallInfo indicates if pressure stall information should be retrieved for the workspace
	WorkspacePressureStallInfoAnnotation = "gitpod.io/psi"

	// ImageNameAnnotation indicates the original format of the main image of the pod
	ImageNameAnnotation = "gitpod.io/image_name"
)

// GetOWIFromObject finds the owner, workspace and instance information on a Kubernetes object using labels
func GetOWIFromObject(pod *metav1.ObjectMeta) logrus.Fields {
	owner := pod.Labels[OwnerLabel]
	workspace := pod.Labels[MetaIDLabel]
	instance := pod.Labels[WorkspaceIDLabel]
	project := pod.Labels[ProjectLabel]
	team := pod.Labels[TeamLabel]
	return log.LogContext(owner, workspace, instance, project, team)
}

// UnlimitedRateLimiter implements an empty, unlimited flowcontrol.RateLimiter
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

func IsRegularWorkspace(pod *corev1.Pod) bool {
	if !IsWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels[TypeLabel]
	return ok && val == "regular"
}

func GetWorkspaceType(pod *corev1.Pod) string {
	val, ok := pod.ObjectMeta.Labels[TypeLabel]
	if !ok {
		return ""
	}
	return val
}

// AddUniqueCondition adds a condition if it doesn't exist already
func AddUniqueCondition(conds []metav1.Condition, cond metav1.Condition) []metav1.Condition {
	if cond.Reason == "" {
		cond.Reason = "Unknown"
	}

	for i, c := range conds {
		if c.Type == cond.Type {
			conds[i] = cond
			return conds
		}
	}

	return append(conds, cond)
}

// GetCondition returns a condition from a list. If not present, it returns nil.
func GetCondition(conds []metav1.Condition, tpe string) *metav1.Condition {
	for _, c := range conds {
		if c.Type == tpe {
			return &c
		}
	}
	return nil
}

// ConditionPresentAndTrue returns whether a condition is present and its status set to True.
func ConditionPresentAndTrue(cond []metav1.Condition, tpe string) bool {
	for _, c := range cond {
		if c.Type == tpe {
			return c.Status == metav1.ConditionTrue
		}
	}
	return false
}

// ConditionWithStatusAndReason returns whether a condition is present, and with the given Reason.
func ConditionWithStatusAndReason(cond []metav1.Condition, tpe string, status bool, reason string) bool {
	st := metav1.ConditionFalse
	if status {
		st = metav1.ConditionTrue
	}
	for _, c := range cond {
		if c.Type == tpe {
			return c.Type == tpe && c.Status == st && c.Reason == reason
		}
	}
	return false
}
