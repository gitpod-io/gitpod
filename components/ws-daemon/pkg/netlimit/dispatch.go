// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package netlimit

import (
	"context"
	"sync"
	"time"

	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/api/resource"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8s "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/prometheus/procfs"
)

const EgressBandwidthAnnotation = "kubernetes.io/egress-bandwidth"

type NetworkLimitConfig struct {
	Enabled       bool              `json:"enabled"`
	EgressLimit   resource.Quantity `json:"egressLimit"`
	EgressWindow  time.Duration     `json:"egressWindow"`
	BandwidthLow  resource.Quantity `json:"bandWidthLow"`
	BandwidthHigh resource.Quantity `json:"bandWidthHigh"`
}

type workspace struct {
	PodName        string
	InitPid        uint64
	PreviousEgress uint64
	LastProbeTime  time.Time
	Limited        bool
}

func NewDispatchListener(cfg *NetworkLimitConfig, clientset *k8s.Clientset, k8sNamespace string) (*DispatchListener, error) {
	proc, err := procfs.NewFS("/proc")
	if err != nil {
		return nil, err
	}

	d := &DispatchListener{
		Config:       cfg,
		workspaces:   make(map[string]*workspace),
		k8sClient:    *clientset,
		k8sNamespace: k8sNamespace,
		proc:         proc,
	}

	go d.Run(context.Background())
	return d, nil
}

type DispatchListener struct {
	Config       *NetworkLimitConfig
	mu           sync.RWMutex
	workspaces   map[string]*workspace
	k8sClient    k8s.Clientset
	k8sNamespace string
	proc         procfs.FS
}

func (d *DispatchListener) Run(ctx context.Context) {
	t := time.NewTimer(d.Config.EgressWindow)
	defer t.Stop()

	go func() {
		for range t.C {
			if err := d.Limit(); err != nil {
				log.Errorf("could not limit network: %v", err)
			}
		}
	}()
}

func (d *DispatchListener) Limit() error {
	d.mu.RLock()
	defer d.mu.RUnlock()

	for _, ws := range d.workspaces {
		if ws.PreviousEgress == 0 || time.Since(ws.LastProbeTime) > d.Config.EgressWindow {
			egress, err := d.getEgressInBytes(ws.InitPid)
			if err != nil {
				log.Errorf("failed to get egress stats: %v", err)
				continue
			}

			ws.PreviousEgress = egress
		}

		currentEgress, err := d.getEgressInBytes(ws.InitPid)
		if err != nil {
			log.Errorf("failed to get egress stats: %v", err)
			continue
		}

		isExhausted := int64(currentEgress-ws.PreviousEgress) > d.Config.EgressLimit.Value()

		if isExhausted && !ws.Limited {
			if err := d.setWorkspaceEgress(ws.PodName, d.Config.BandwidthLow); err != nil {
				log.Errorf("failed to penalize workspace %s", ws.PodName)
				continue
			}

			ws.Limited = true
		}

		if !isExhausted && ws.Limited {
			if err := d.setWorkspaceEgress(ws.PodName, d.Config.BandwidthHigh); err != nil {
				log.Errorf("failed to penalize workspace %s", ws.PodName)
				continue
			}
			ws.Limited = false
		}
	}

	return nil
}

func (d *DispatchListener) getEgressInBytes(pid uint64) (uint64, error) {
	p, err := d.proc.Proc(int(pid))
	if err != nil {
		return 0, err
	}

	nd, err := p.NetDev()
	if err != nil {
		return 0, err
	}

	return nd.Total().TxBytes, nil
}

func (d *DispatchListener) setWorkspaceEgress(podname string, limit resource.Quantity) error {
	ctx := context.Background()
	retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		pods := d.k8sClient.CoreV1().Pods(d.k8sNamespace)
		pod, err := pods.Get(ctx, podname, v1.GetOptions{})
		if err != nil {
			return err
		}

		pod.Annotations[EgressBandwidthAnnotation] = limit.String()
		_, err = pods.Update(ctx, pod, v1.UpdateOptions{})
		if err != nil {
			return err
		}

		return nil
	})

	return nil
}

func (d *DispatchListener) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}

	pid, err := disp.Runtime.ContainerPID(context.Background(), ws.ContainerID)
	if err != nil {
		return xerrors.Errorf("could not find container for workspace %s", ws.InstanceID)
	}

	d.workspaces[ws.InstanceID] = &workspace{
		PodName: ws.Pod.Name,
		InitPid: pid,
	}

	go func() {
		<-ctx.Done()

		d.mu.Lock()
		defer d.mu.Unlock()
		delete(d.workspaces, ws.InstanceID)
	}()

	return nil
}

func (d *DispatchListener) WorkspaceUpdated(ctx context.Context, ws *dispatch.Workspace) error {
	return nil
}
