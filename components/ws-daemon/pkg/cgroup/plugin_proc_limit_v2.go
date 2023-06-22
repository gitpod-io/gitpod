// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"path/filepath"
	"sync"

	v2 "github.com/containerd/cgroups/v2"
	"github.com/gitpod-io/gitpod/common-go/log"
)

type ProcLimiterV2 struct {
	limits *v2.Resources

	cond *sync.Cond
}

func NewProcLimiterV2(processes int64) (*ProcLimiterV2, error) {
	return &ProcLimiterV2{
		limits: &v2.Resources{
			Pids: &v2.Pids{
				Max: processes,
			},
		},

		cond: sync.NewCond(&sync.Mutex{}),
	}, nil
}

func (c *ProcLimiterV2) Name() string  { return "proc-limiter-v2" }
func (c *ProcLimiterV2) Type() Version { return Version2 }

func (c *ProcLimiterV2) Apply(ctx context.Context, opts *PluginOptions) error {
	update := make(chan struct{}, 1)
	go func() {
		defer close(update)

		for {
			c.cond.L.Lock()
			c.cond.Wait()
			c.cond.L.Unlock()

			if ctx.Err() != nil {
				return
			}

			update <- struct{}{}
		}
	}()

	go func() {
		log.WithField("cgroupPath", opts.CgroupPath).Debug("starting proc limiting")

		_, err := v2.NewManager(opts.BasePath, filepath.Join("/", opts.CgroupPath), c.limits)
		if err != nil {
			log.WithError(err).WithFields(log.OWI("", "", opts.InstanceId)).WithField("basePath", opts.BasePath).WithField("cgroupPath", opts.CgroupPath).WithField("limits", c.limits).Error("cannot write proc limits")
		}

		for {
			select {
			case <-update:
				_, err := v2.NewManager(opts.BasePath, filepath.Join("/", opts.CgroupPath), c.limits)
				if err != nil {
					log.WithError(err).WithFields(log.OWI("", "", opts.InstanceId)).WithField("basePath", opts.BasePath).WithField("cgroupPath", opts.CgroupPath).WithField("limits", c.limits).Error("cannot write proc limits")
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	return nil
}

func (c *ProcLimiterV2) Update(processes int64) {
	c.cond.L.Lock()
	defer c.cond.L.Unlock()

	c.limits = &v2.Resources{
		Pids: &v2.Pids{
			Max: processes,
		},
	}

	log.WithField("limits", c.limits.Pids).Info("updating proc cgroups v2 limits")
	c.cond.Broadcast()
}
