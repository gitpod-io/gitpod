// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"net/http"
	"sync"
	"time"

	k8serr "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
)

const (
	// propagationGracePeriod is the time we allow on top of a container's deletionGracePeriod
	// to make sure the changes propagate on the data plane.
	propagationGracePeriod = 10 * time.Second

	maxDeletionAttempts     = 10
	deletionAttemptInterval = 2 * time.Second
)

// Containerd4214Workaround words around https://github.com/containerd/containerd/pull/4214
//
// containerd/runc had an issue where if runc deleted a container and containerd would not know about it
// the Kubernetes CRI would fail to stop the pod. This bug was fixed in containerd 1.4.0 and backported
// to containerd 1.3.7.
//
// Some clusters might run an older version of containerd, for which we build this workaround.
type Containerd4214Workaround struct {
	mu      sync.Mutex
	handled map[string]struct{}
}

// WorkspaceAdded does nothing but implemented the dispatch.Listener interface
func (c *Containerd4214Workaround) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	return nil
}

// WorkspaceUpdated gets called when a workspace pod is updated. For containers being deleted, we'll check
// if they're still running after their terminationGracePeriod and if Kubernetes still knows about them.
func (c *Containerd4214Workaround) WorkspaceUpdated(ctx context.Context, ws *dispatch.Workspace) error {
	if ws.Pod.DeletionTimestamp == nil {
		return nil
	}

	c.mu.Lock()
	if c.handled == nil {
		c.handled = make(map[string]struct{})
	}
	if _, exists := c.handled[ws.InstanceID]; exists {
		c.mu.Unlock()
		return nil
	}
	c.handled[ws.InstanceID] = struct{}{}
	c.mu.Unlock()

	var gracePeriod int64
	if ws.Pod.DeletionGracePeriodSeconds != nil {
		gracePeriod = *ws.Pod.DeletionGracePeriodSeconds
	} else {
		gracePeriod = 30
	}
	ttl := time.Duration(gracePeriod)*time.Second + propagationGracePeriod

	dsp := dispatch.GetFromContext(ctx)
	go func() {
		time.Sleep(ttl)
		err := c.ensurePodGetsDeleted(dsp.Runtime, dsp.Kubernetes, ws)
		if err != nil {
			log.WithError(err).Error("cannot ensure workspace pod gets deleted")
		}
	}()

	return nil
}

// ensurePodGetsDeleted will check if the container still exists on this node, i.e. still runs.
// If it doesn't, it'll force delete it from Kubernetes. We'll retry several times, with an exponential
// back-off.
func (c *Containerd4214Workaround) ensurePodGetsDeleted(rt container.Runtime, clientSet kubernetes.Interface, ws *dispatch.Workspace) (err error) {
	var (
		log         = log.WithFields(ws.OWI())
		podName     = ws.Pod.Name
		namespace   = ws.Pod.Namespace
		containerID = ws.ContainerID
	)

	delay := deletionAttemptInterval
	for attempt := 0; attempt < maxDeletionAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(delay)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		var exists bool
		exists, err = rt.ContainerExists(ctx, containerID)
		cancel()
		if err != nil {
			log.WithField("attempt", attempt).WithError(err).Warn("Containerd4214Workaround cannot check if container still exists")
			continue
		}
		if exists {
			continue
		}

		err = retry.RetryOnConflict(retry.DefaultBackoff, func() error {
			ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			pod, err := clientSet.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
			if err != nil {
				return err
			}

			pod.Annotations[wsk8s.ContainerIsGoneAnnotation] = "true"
			_, err = clientSet.CoreV1().Pods(namespace).Update(ctx, pod, metav1.UpdateOptions{})
			return err
		})
		if err != nil {
			log.WithField("attempt", attempt).WithError(err).WithField("containerID", containerID).Warn("cannot mark workspace container as gone")
			continue
		}

		ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		err = clientSet.CoreV1().Pods(namespace).Delete(ctx, podName, *metav1.NewDeleteOptions(0))
		if err, ok := err.(*k8serr.StatusError); ok && err.ErrStatus.Code == http.StatusNotFound {
			return nil
		}
		if err != nil {
			log.WithField("attempt", attempt).WithError(err).WithField("containerID", containerID).Warn("cannot force-delete orphaned workspace pod")
			continue
		}

		log.WithField("attempt", attempt).Info("force-deleted workspace pod after its container was gone")
		return nil
	}
	return err
}
