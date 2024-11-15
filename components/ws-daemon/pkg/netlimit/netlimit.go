// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package netlimit

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"

	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/nsinsider"
	"github.com/google/nftables"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/vishvananda/netns"
)

type ConnLimiter struct {
	mu             sync.RWMutex
	limited        map[string]struct{}
	droppedBytes   *prometheus.GaugeVec
	droppedPackets *prometheus.GaugeVec
	config         Config
}

func NewConnLimiter(config Config, prom prometheus.Registerer) *ConnLimiter {
	s := &ConnLimiter{
		droppedBytes: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "netlimit_connections_dropped_bytes",
			Help: "Number of bytes dropped due to connection limiting",
		}, []string{"node", "workspace"}),

		droppedPackets: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "netlimit_connections_dropped_packets",
			Help: "Number of packets dropped due to connection limiting",
		}, []string{"node", "workspace"}),
		limited: map[string]struct{}{},
	}

	s.config = config

	if config.Enabled {
		prom.MustRegister(
			s.droppedBytes,
			s.droppedPackets,
		)
	}

	return s
}

func (c *ConnLimiter) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	_, hasAnnotation := ws.Pod.Annotations[kubernetes.WorkspaceNetConnLimitAnnotation]
	if !hasAnnotation {
		return nil
	}

	return c.limitWorkspace(ctx, ws)
}

func (c *ConnLimiter) WorkspaceUpdated(ctx context.Context, ws *dispatch.Workspace) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	_, hasAnnotation := ws.Pod.Annotations[kubernetes.WorkspaceNetConnLimitAnnotation]
	if !hasAnnotation {
		return nil
	}

	if _, ok := c.limited[ws.InstanceID]; ok {
		return nil
	}

	return c.limitWorkspace(ctx, ws)
}

func (n *ConnLimiter) GetConnectionDropCounter(pid uint64) (*nftables.CounterObj, error) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	netns, err := netns.GetFromPid(int(pid))
	if err != nil {
		return nil, fmt.Errorf("could not get handle for network namespace: %w", err)
	}

	nftconn, err := nftables.New(nftables.WithNetNSFd(int(netns)))
	if err != nil {
		return nil, fmt.Errorf("could not establish netlink connection for nft: %w", err)
	}

	gitpodTable := &nftables.Table{
		Name:   "gitpod",
		Family: nftables.TableFamilyIPv4,
	}

	counterObject, err := nftconn.GetObject(&nftables.CounterObj{
		Table: gitpodTable,
		Name:  "ws-connection-drop-stats",
	})

	if err != nil {
		return nil, fmt.Errorf("could not get connection drop stats: %w", err)
	}

	dropCounter, ok := counterObject.(*nftables.CounterObj)
	if !ok {
		return nil, fmt.Errorf("could not cast counter object")
	}

	return dropCounter, nil
}

func (c *ConnLimiter) limitWorkspace(ctx context.Context, ws *dispatch.Workspace) error {
	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return fmt.Errorf("no dispatch available")
	}

	pid, err := disp.Runtime.ContainerPID(ctx, ws.ContainerID)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil
		}
		return fmt.Errorf("could not get pid for container %s of workspace %s", ws.ContainerID, ws.WorkspaceID)
	}

	err = nsinsider.Nsinsider(ws.InstanceID, int(pid), func(cmd *exec.Cmd) {
		cmd.Args = append(cmd.Args, "setup-connection-limit", "--limit", strconv.Itoa(int(c.config.ConnectionsPerMinute)),
			"--bucketsize", strconv.Itoa(int(c.config.BucketSize)))
		if c.config.Enforce {
			cmd.Args = append(cmd.Args, "--enforce")
		}
	}, nsinsider.EnterMountNS(false), nsinsider.EnterNetNS(true))
	if err != nil {
		if errors.Is(context.Cause(ctx), context.Canceled) {
			return nil
		}
		log.WithError(err).WithFields(ws.OWI()).Error("cannot enable connection limiting")
		return err
	}
	c.limited[ws.InstanceID] = struct{}{}

	dispatch.GetDispatchWaitGroup(ctx).Add(1)
	go func(*dispatch.Workspace) {
		defer dispatch.GetDispatchWaitGroup(ctx).Done()

		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				counter, err := c.GetConnectionDropCounter(pid)
				if err != nil {
					log.WithFields(ws.OWI()).WithError(err).Warnf("could not get connection drop stats")
					continue
				}

				nodeName := os.Getenv("NODENAME")
				c.droppedBytes.WithLabelValues(nodeName, ws.Pod.Name).Set(float64(counter.Bytes))
				c.droppedPackets.WithLabelValues(nodeName, ws.Pod.Name).Set(float64(counter.Packets))

			case <-ctx.Done():
				c.mu.Lock()
				delete(c.limited, ws.InstanceID)
				c.mu.Unlock()
				return
			}
		}
	}(ws)

	return nil
}

func (c *ConnLimiter) Update(config Config) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.config = config
	log.WithField("config", config).Info("updating network connection limits")
}
