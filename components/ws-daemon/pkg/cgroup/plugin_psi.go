// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"os"
	"path/filepath"
	"time"

	cgroups "github.com/gitpod-io/gitpod/common-go/cgroups/v2"
	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/prometheus"
)

type PSIMetrics struct {
	cpu      *prometheus.GaugeVec
	memory   *prometheus.GaugeVec
	io       *prometheus.GaugeVec
	nodeName string
}

func NewPSIMetrics(prom prometheus.Registerer) *PSIMetrics {
	p := &PSIMetrics{
		cpu: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "workspace_cpu_psi_total_seconds",
			Help: "Total time spent under cpu pressure in microseconds",
		}, []string{"node", "workspace", "kind"}),

		memory: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "workspace_memory_psi_total_seconds",
			Help: "Total time spent under memory pressure in microseconds",
		}, []string{"node", "workspace", "kind"}),

		io: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "workspace_io_psi_total_seconds",
			Help: "Total time spent under io pressure in microseconds",
		}, []string{"node", "workspace", "kind"}),

		nodeName: os.Getenv("NODENAME"),
	}

	prom.MustRegister(
		p.cpu,
		p.memory,
		p.io,
	)

	return p
}

func (p *PSIMetrics) Name() string  { return "psi-metrics" }
func (p *PSIMetrics) Type() Version { return Version2 }

func (p *PSIMetrics) Apply(ctx context.Context, opts *PluginOptions) error {
	if _, v := opts.Annotations[kubernetes.WorkspacePressureStallInfoAnnotation]; !v {
		return nil
	}

	fullPath := filepath.Join(opts.BasePath, opts.CgroupPath)
	if _, err := os.Stat(fullPath); err != nil {
		return err
	}

	cpu := cgroups.NewCpuController(fullPath)
	memory := cgroups.NewMemoryController(fullPath)
	io := cgroups.NewIOController(fullPath)

	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				p.scrape(cpu, memory, io, opts.InstanceId)
			case <-ctx.Done():
				return
			}
		}
	}()

	return nil
}

func (p *PSIMetrics) scrape(cpu *cgroups.Cpu, memory *cgroups.Memory, io *cgroups.IO, instanceID string) {
	if psi, err := cpu.PSI(); err == nil {
		p.cpu.WithLabelValues(p.nodeName, instanceID, "some").Set(float64(psi.Some))
		p.cpu.WithLabelValues(p.nodeName, instanceID, "full").Set(float64(psi.Full))
	} else if !os.IsNotExist(err) {
		log.WithError(err).WithFields(log.OWI("", "", instanceID)).Warn("could not retrieve cpu psi")
	}

	if psi, err := memory.PSI(); err == nil {
		p.memory.WithLabelValues(p.nodeName, instanceID, "some").Set(float64(psi.Some))
		p.memory.WithLabelValues(p.nodeName, instanceID, "full").Set(float64(psi.Full))
	} else if !os.IsNotExist(err) {
		log.WithError(err).WithFields(log.OWI("", "", instanceID)).Warn("could not retrieve memory psi")
	}

	if psi, err := io.PSI(); err == nil {
		p.io.WithLabelValues(p.nodeName, instanceID, "some").Set(float64(psi.Some))
		p.io.WithLabelValues(p.nodeName, instanceID, "full").Set(float64(psi.Full))
	} else if !os.IsNotExist(err) {
		log.WithError(err).WithFields(log.OWI("", "", instanceID)).Warn("could not retrieve io psi")
	}
}
