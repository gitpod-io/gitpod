// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/flowcontrol"
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

	// TraceIDAnnotation adds a Jaeger/OpenTracing header to the pod so that we can trace it's behaviour
	TraceIDAnnotation = "gitpod/traceid"

	// CPULimitAnnotation enforces a strict CPU limit on a workspace by virtue of ws-manager-node
	CPULimitAnnotation = "gitpod/cpuLimit"
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

var typecheck flowcontrol.RateLimiter = &UnlimitedRateLimiter{}

// TryAccept returns true if a token is taken immediately. Otherwise,
// it returns false.
func (u *UnlimitedRateLimiter) TryAccept() bool {
	return true
}

// Accept returns once a token becomes available.
func (u *UnlimitedRateLimiter) Accept() {
	return
}

// Stop stops the rate limiter, subsequent calls to CanAccept will return false
func (u *UnlimitedRateLimiter) Stop() {
	return
}

// QPS returns QPS of this rate limiter
func (u *UnlimitedRateLimiter) QPS() float32 {
	return math.MaxFloat32
}

// Wait returns nil if a token is taken before the Context is done.
func (u *UnlimitedRateLimiter) Wait(ctx context.Context) error {
	return nil
}
