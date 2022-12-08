// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cpulimit

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/api/resource"

	"github.com/gitpod-io/gitpod/common-go/cgroups"
	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
)

// Config configures the containerd resource governer dispatch
type Config struct {
	Enabled        bool              `json:"enabled"`
	TotalBandwidth resource.Quantity `json:"totalBandwidth"`
	Limit          resource.Quantity `json:"limit"`
	BurstLimit     resource.Quantity `json:"burstLimit"`

	ControlPeriod  util.Duration `json:"controlPeriod"`
	CGroupBasePath string        `json:"cgroupBasePath"`
}

// NewDispatchListener creates a new resource governer dispatch listener
func NewDispatchListener(cfg *Config, prom prometheus.Registerer) *DispatchListener {
	d := &DispatchListener{
		Prometheus: prom,
		Config:     cfg,
		workspaces: make(map[string]*workspace),

		workspacesAddedCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "cpulimit_workspaces_added_total",
			Help: "Number of workspaces added to CPU control",
		}, []string{"qos"}),
		workspacesRemovedCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "cpulimit_workspaces_removed_total",
			Help: "Number of workspaces removed from CPU control",
		}, []string{"qos"}),
		workspacesThrottledCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "cpulimit_workspaces_throttled_total",
			Help: "Number of workspaces which ran with throttled CPU",
		}, []string{"qos"}),
		workspacesBurstCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "cpulimit_workspaces_burst_total",
			Help: "Number of workspaces which received burst CPU limits",
		}, []string{"qos"}),
		workspacesCPUTimeVec: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "cpulimit_workspaces_cputime_seconds",
			Help: "CPU time of all observed workspaces",
		}, []string{"qos"}),
	}

	if cfg.Enabled {
		dist := NewDistributor(d.source, d.sink,
			CompositeLimiter(AnnotationLimiter(kubernetes.WorkspaceCpuMinLimitAnnotation), FixedLimiter(BandwidthFromQuantity(d.Config.Limit))),
			CompositeLimiter(AnnotationLimiter(kubernetes.WorkspaceCpuBurstLimitAnnotation), FixedLimiter(BandwidthFromQuantity(d.Config.BurstLimit))),
			BandwidthFromQuantity(d.Config.TotalBandwidth),
		)
		go dist.Run(context.Background(), time.Duration(d.Config.ControlPeriod))
	}

	prom.MustRegister(
		d.workspacesAddedCounterVec,
		d.workspacesRemovedCounterVec,
		d.workspacesThrottledCounterVec,
		d.workspacesBurstCounterVec,
		d.workspacesCPUTimeVec,
	)

	return d
}

// DispatchListener starts new resource governer using the workspace dispatch
type DispatchListener struct {
	Prometheus prometheus.Registerer
	Config     *Config

	workspaces map[string]*workspace
	mu         sync.RWMutex

	workspacesAddedCounterVec     *prometheus.CounterVec
	workspacesRemovedCounterVec   *prometheus.CounterVec
	workspacesThrottledCounterVec *prometheus.CounterVec
	workspacesBurstCounterVec     *prometheus.CounterVec
	workspacesCPUTimeVec          *prometheus.GaugeVec
}

type workspace struct {
	CFS         CFSController
	OWI         logrus.Fields
	HardLimit   ResourceLimiter
	Annotations map[string]string

	lastThrottled uint64
}

func (d *DispatchListener) source(context.Context) ([]Workspace, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	res := make([]Workspace, 0, len(d.workspaces))
	d.workspacesCPUTimeVec.Reset()
	for id, w := range d.workspaces {
		usage, err := w.CFS.Usage()
		if err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				log.WithFields(w.OWI).WithError(err).Warn("cannot read CPU usage")
			}

			continue
		}

		throttled, err := w.CFS.NrThrottled()
		if err != nil {
			log.WithFields(w.OWI).WithError(err).Warn("cannot read times cgroup was throttled")
			// we don't continue here, because worst case the cgroup will get too low a
			// limit, but at least we'll keep maintaining the limit.
		}

		if w.lastThrottled > 0 && w.lastThrottled != throttled {
			d.workspacesThrottledCounterVec.WithLabelValues("none").Inc()
		}
		w.lastThrottled = throttled

		d.workspacesCPUTimeVec.WithLabelValues("none").Add(time.Duration(usage).Seconds())

		res = append(res, Workspace{
			ID:          id,
			NrThrottled: throttled,
			Usage:       usage,
			Annotations: w.Annotations,
		})
	}
	return res, nil
}

func (d *DispatchListener) sink(id string, limit Bandwidth, burst bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	ws, ok := d.workspaces[id]
	if !ok {
		// this can happen if the workspace has gone away inbetween a distributor cycle
		return
	}

	d.workspacesBurstCounterVec.WithLabelValues("none").Inc()

	changed, err := ws.CFS.SetLimit(limit)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		log.WithError(err).WithFields(ws.OWI).Warn("cannot set CPU limit")
	}
	if changed {
		log.WithFields(ws.OWI).WithField("limit", limit).Debug("applied new CPU limit")
	}
}

// WorkspaceAdded starts new governer
func (d *DispatchListener) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}

	cgroupPath, err := disp.Runtime.ContainerCGroupPath(context.Background(), ws.ContainerID)
	if err != nil {
		return xerrors.Errorf("cannot start governer: %w", err)
	}

	controller, err := newCFSController(d.Config.CGroupBasePath, cgroupPath)
	if err != nil {
		return xerrors.Errorf("cannot start CFS controller: %w", err)
	}

	d.workspaces[ws.InstanceID] = &workspace{
		CFS:         controller,
		OWI:         ws.OWI(),
		Annotations: ws.Pod.Annotations,
	}
	go func() {
		<-ctx.Done()

		d.mu.Lock()
		defer d.mu.Unlock()
		delete(d.workspaces, ws.InstanceID)
		d.workspacesRemovedCounterVec.WithLabelValues("none").Inc()
	}()

	d.workspacesAddedCounterVec.WithLabelValues("none").Inc()

	return nil
}

// WorkspaceUpdated gets called when a workspace is updated
func (d *DispatchListener) WorkspaceUpdated(ctx context.Context, ws *dispatch.Workspace) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	wsinfo, ok := d.workspaces[ws.InstanceID]
	if !ok {
		return xerrors.Errorf("received update for a workspace we haven't seen before: %s", ws.InstanceID)
	}

	wsinfo.Annotations = ws.Pod.Annotations
	return nil
}

func newCFSController(basePath, cgroupPath string) (CFSController, error) {
	unified, err := cgroups.IsUnifiedCgroupSetup()
	if err != nil {
		return nil, xerrors.Errorf("could not determine cgroup setup: %w", err)
	}

	if unified {
		fullPath := filepath.Join(basePath, cgroupPath)
		if err := cgroups.EnsureCpuControllerEnabled(basePath, filepath.Join("/", cgroupPath)); err != nil {
			return nil, xerrors.Errorf("could not check CPU controller is enabled: %w", err)
		}

		return CgroupV2CFSController(fullPath), nil
	} else {
		return CgroupV1CFSController(filepath.Join(basePath, "cpu", cgroupPath)), nil
	}
}
