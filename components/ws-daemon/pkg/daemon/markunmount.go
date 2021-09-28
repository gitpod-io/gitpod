// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"io/ioutil"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	// propagationGracePeriod is the time we allow on top of a container's deletionGracePeriod
	// to make sure the changes propagate on the data plane.
	propagationGracePeriod = 10 * time.Second
)

// NewMarkUnmountFallback produces a new MarkUnmountFallback. reg can be nil
func NewMarkUnmountFallback(reg prometheus.Registerer) (*MarkUnmountFallback, error) {
	counter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "markunmountfallback_active_total",
		Help: "counts how often the mark unmount fallback was active",
	}, []string{"successful"})
	if reg != nil {
		err := reg.Register(counter)
		if err != nil {
			return nil, err
		}
	}

	return &MarkUnmountFallback{
		activityCounter: counter,
	}, nil
}

// MarkUnmountFallback works around the mount propagation of the ring1 FS mark mount.
// When ws-daemon restarts runc propagates all rootfs mounts to ws-daemon's mount namespace.
// This prevents proper unmounting of the mark mount, hence the rootfs of the workspace container.
//
// To work around this issue we wait pod.terminationGracePeriod + propagationGracePeriod and,
// after which we attempt to unmount the mark mount.
//
// Some clusters might run an older version of containerd, for which we build this workaround.
type MarkUnmountFallback struct {
	mu      sync.Mutex
	handled map[string]struct{}

	activityCounter *prometheus.CounterVec
}

// WorkspaceAdded does nothing but implemented the dispatch.Listener interface
func (c *MarkUnmountFallback) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	return nil
}

// WorkspaceUpdated gets called when a workspace pod is updated. For containers being deleted, we'll check
// if they're still running after their terminationGracePeriod and if Kubernetes still knows about them.
func (c *MarkUnmountFallback) WorkspaceUpdated(ctx context.Context, ws *dispatch.Workspace) error {
	if ws.Pod.DeletionTimestamp == nil {
		return nil
	}

	err := func() error {
		c.mu.Lock()
		defer c.mu.Unlock()

		if c.handled == nil {
			c.handled = make(map[string]struct{})
		}
		if _, exists := c.handled[ws.InstanceID]; exists {
			return nil
		}
		c.handled[ws.InstanceID] = struct{}{}
		return nil
	}()
	if err != nil {
		return err
	}

	var gracePeriod int64
	if ws.Pod.DeletionGracePeriodSeconds != nil {
		gracePeriod = *ws.Pod.DeletionGracePeriodSeconds
	} else {
		gracePeriod = 30
	}
	ttl := time.Duration(gracePeriod)*time.Second + propagationGracePeriod

	go func() {
		time.Sleep(ttl)

		dsp := dispatch.GetFromContext(ctx)
		if !dsp.WorkspaceExistsOnNode(ws.InstanceID) {
			// container is already gone - all is well
			return
		}

		err := unmountMark(ws.InstanceID)
		if err != nil {
			log.WithFields(ws.OWI()).WithError(err).Error("cannot unmount mark mount from within ws-daemon")
			c.activityCounter.WithLabelValues("false").Inc()
		} else {
			c.activityCounter.WithLabelValues("true").Inc()
		}

		// We expect the container to be gone now. Don't keep its referenec in memory.
		c.mu.Lock()
		delete(c.handled, ws.InstanceID)
		c.mu.Unlock()
	}()

	return nil
}

// if the mark mount still exists in /proc/mounts it means we failed to unmount it and
// we cannot remove the content. As a side effect the pod will stay in Terminating state
func unmountMark(instanceID string) error {
	mounts, err := ioutil.ReadFile("/proc/mounts")
	if err != nil {
		return xerrors.Errorf("cannot read /proc/mounts: %w", err)
	}

	dir := content.ServiceDirName(instanceID)
	path := fromPartialMount(filepath.Join(dir, "mark"), mounts)
	// empty path means no mount found
	if len(path) == 0 {
		return nil
	}

	// in some scenarios we need to wait for the unmount
	var errorFn = func(err error) bool {
		return strings.Contains(err.Error(), "device or resource busy")
	}

	var eg errgroup.Group
	for _, p := range path {
		// add p as closure so that we can use it inside the Go routine.
		p := p
		eg.Go(func() error {
			return retry.OnError(wait.Backoff{
				Steps:    5,
				Duration: 1 * time.Second,
				Factor:   5.0,
				Jitter:   0.1,
			}, errorFn, func() error {
				return unix.Unmount(p, 0)
			})
		})
	}
	return eg.Wait()
}

func fromPartialMount(path string, info []byte) (res []string) {
	scanner := bufio.NewScanner(bytes.NewReader(info))
	for scanner.Scan() {
		mount := strings.Split(scanner.Text(), " ")
		if len(mount) < 2 {
			continue
		}

		if strings.Contains(mount[1], path) {
			res = append(res, mount[1])
		}
	}

	return res
}
