// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"time"

	v2 "github.com/containerd/cgroups/v2"
	"github.com/gitpod-io/gitpod/common-go/log"
)

type ioLimitOptions struct {
	WriteBytesPerSecond uint64
	ReadBytesPerSecond  uint64
	WriteIOPs           uint64
	ReadIOPs            uint64
}

type IOLimiterV2 struct {
	limits ioLimitOptions
}

func NewIOLimiterV2(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs uint64) *IOLimiterV2 {
	limits := ioLimitOptions{
		WriteBytesPerSecond: writeBytesPerSecond,
		ReadBytesPerSecond:  readBytesPerSecond,
		WriteIOPs:           writeIOPs,
		ReadIOPs:            readIOPs,
	}

	return &IOLimiterV2{
		limits: limits,
	}
}

func (c *IOLimiterV2) Name() string  { return "iolimiter-v2" }
func (c *IOLimiterV2) Type() Version { return Version2 }

func (c *IOLimiterV2) Apply(ctx context.Context, basePath, cgroupPath string) error {
	res := v2.Resources{
		IO: &v2.IO{
			Max: []v2.Entry{
				{
					Type: v2.ReadBPS, Major: 8, Minor: 0, Rate: c.limits.ReadBytesPerSecond,
				},
				{
					Type: v2.WriteBPS, Major: 8, Minor: 0, Rate: c.limits.WriteBytesPerSecond,
				},
				{
					Type: v2.ReadIOPS, Major: 8, Minor: 0, Rate: c.limits.ReadIOPs,
				},
				{
					Type: v2.WriteIOPS, Major: 8, Minor: 0, Rate: c.limits.WriteIOPs,
				},
			},
		},
	}

	mgr, err := v2.NewManager(basePath, cgroupPath, &res)
	if err != nil {
		return err
	}

	ctrls, err := mgr.Controllers()
	if err != nil {
		return err
	}

	log.WithField("ctrls", ctrls).Debug("io limiting controller started")

	go func() {
		log.WithField("cgroupPath", cgroupPath).Debug("starting io limiting")
		// We are racing workspacekit and the interaction with disks.
		// If we did this just once there's a chance we haven't interacted with all
		// devices yet, and hence would not impose IO limits on them.
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.WithField("cgroupPath", cgroupPath).Debug("stopping io limiting")
				return
			case <-ticker.C:
			}
		}
	}()

	return nil
}
