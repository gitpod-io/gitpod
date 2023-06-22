// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	v2 "github.com/containerd/cgroups/v2"
	"github.com/gitpod-io/gitpod/common-go/log"
)

type IOLimiterV2 struct {
	limits *v2.Resources

	cond *sync.Cond

	devices []string
}

func NewIOLimiterV2(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs int64) (*IOLimiterV2, error) {
	devices := buildDevices()
	log.WithField("devices", devices).Debug("io limiting devices")
	return &IOLimiterV2{
		limits: buildV2Limits(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs, devices),

		cond:    sync.NewCond(&sync.Mutex{}),
		devices: devices,
	}, nil
}

func (c *IOLimiterV2) Name() string  { return "iolimiter-v2" }
func (c *IOLimiterV2) Type() Version { return Version2 }

func (c *IOLimiterV2) Apply(ctx context.Context, opts *PluginOptions) error {
	update := make(chan struct{}, 1)
	go func() {
		// TODO(cw): this Go-routine will leak per workspace, until we update config or restart ws-daemon
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
		log.WithFields(log.OWI("", "", opts.InstanceId)).WithField("cgroupPath", opts.CgroupPath).Debug("starting io limiting")

		_, err := v2.NewManager(opts.BasePath, filepath.Join("/", opts.CgroupPath), c.limits)
		if err != nil {
			log.WithError(err).WithFields(log.OWI("", "", opts.InstanceId)).WithField("basePath", opts.BasePath).WithField("cgroupPath", opts.CgroupPath).WithField("limits", c.limits).Warn("cannot write IO limits")
		}

		for {
			select {
			case <-update:
				_, err := v2.NewManager(opts.BasePath, filepath.Join("/", opts.CgroupPath), c.limits)
				if err != nil {
					log.WithError(err).WithFields(log.OWI("", "", opts.InstanceId)).WithField("basePath", opts.BasePath).WithField("cgroupPath", opts.CgroupPath).WithField("limits", c.limits).Error("cannot write IO limits")
				}
			case <-ctx.Done():
				// Prior to shutting down though, we need to reset the IO limits to ensure we don't have
				// processes stuck in the uninterruptable "D" (disk sleep) state. This would prevent the
				// workspace pod from shutting down.
				_, err := v2.NewManager(opts.BasePath, filepath.Join("/", opts.CgroupPath), &v2.Resources{})
				if err != nil {
					log.WithError(err).WithFields(log.OWI("", "", opts.InstanceId)).WithField("cgroupPath", opts.CgroupPath).Error("cannot write IO limits")
				}
				log.WithFields(log.OWI("", "", opts.InstanceId)).WithField("cgroupPath", opts.CgroupPath).Debug("stopping io limiting")
				return
			}
		}
	}()

	return nil
}

func (c *IOLimiterV2) Update(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs int64) {
	c.cond.L.Lock()
	defer c.cond.L.Unlock()

	c.limits = buildV2Limits(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs, c.devices)
	log.WithField("limits", c.limits.IO).Info("updating I/O cgroups v2 limits")

	c.cond.Broadcast()
}

func buildV2Limits(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs int64, devices []string) *v2.Resources {
	resources := &v2.Resources{
		IO: &v2.IO{},
	}

	for _, device := range devices {
		majmin := strings.Split(device, ":")
		if len(majmin) != 2 {
			log.WithField("device", device).Error("invalid device")
			continue
		}

		major, err := strconv.ParseInt(majmin[0], 10, 64)
		if err != nil {
			log.WithError(err).Error("invalid major device")
			continue
		}

		minor, err := strconv.ParseInt(majmin[1], 10, 64)
		if err != nil {
			log.WithError(err).Error("invalid minor device")
			continue
		}

		if readBytesPerSecond > 0 {
			resources.IO.Max = append(resources.IO.Max, v2.Entry{Major: major, Minor: minor, Type: v2.ReadBPS, Rate: uint64(readBytesPerSecond)})
		}

		if readIOPs > 0 {
			resources.IO.Max = append(resources.IO.Max, v2.Entry{Major: major, Minor: minor, Type: v2.ReadIOPS, Rate: uint64(readIOPs)})
		}

		if writeBytesPerSecond > 0 {
			resources.IO.Max = append(resources.IO.Max, v2.Entry{Major: major, Minor: minor, Type: v2.WriteBPS, Rate: uint64(writeBytesPerSecond)})
		}

		if writeIOPs > 0 {
			resources.IO.Max = append(resources.IO.Max, v2.Entry{Major: major, Minor: minor, Type: v2.WriteIOPS, Rate: uint64(writeIOPs)})
		}
	}

	log.WithField("resources", resources).Debug("cgroups v2 limits")

	return resources
}

// TODO: enable custom configuration
var blockDevices = []string{"dm*", "sd*", "md*", "nvme*"}

func buildDevices() []string {
	var devices []string
	for _, wc := range blockDevices {
		matches, err := filepath.Glob(filepath.Join("/sys/block", wc, "dev"))
		if err != nil {
			log.WithField("wc", wc).Warn("cannot glob devices")
			continue
		}

		for _, dev := range matches {
			fc, err := os.ReadFile(dev)
			if err != nil {
				log.WithField("dev", dev).WithError(err).Error("cannot read device file")
			}
			devices = append(devices, strings.TrimSpace(string(fc)))
		}
	}

	return devices
}
