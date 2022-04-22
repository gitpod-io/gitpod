// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
)

type IOLimiterV1 struct {
	limits limits

	cond *sync.Cond
}

type limits struct {
	WriteBytesPerSecond int64
	ReadBytesPerSecond  int64
	WriteIOPS           int64
	ReadIOPS            int64
}

func NewIOLimiterV1(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs int64) *IOLimiterV1 {
	return &IOLimiterV1{
		limits: limits{
			WriteBytesPerSecond: writeBytesPerSecond,
			ReadBytesPerSecond:  readBytesPerSecond,
			WriteIOPS:           writeIOPs,
			ReadIOPS:            readIOPs,
		},
		cond: sync.NewCond(&sync.Mutex{}),
	}
}

func (c *IOLimiterV1) Name() string  { return "iolimiter-v1" }
func (c *IOLimiterV1) Type() Version { return Version1 }

const (
	fnBlkioThrottleWriteBps  = "blkio.throttle.write_bps_device"
	fnBlkioThrottleReadBps   = "blkio.throttle.read_bps_device"
	fnBlkioThrottleWriteIOPS = "blkio.throttle.write_iops_device"
	fnBlkioThrottleReadIOPS  = "blkio.throttle.read_iops_device"
)

// TODO: enable custom configuration
var blockDevices = []string{"sd*", "md*", "nvme0n*"}

func (c *IOLimiterV1) Update(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs int64) {
	c.cond.L.Lock()
	defer c.cond.L.Unlock()

	c.limits = limits{
		WriteBytesPerSecond: writeBytesPerSecond,
		ReadBytesPerSecond:  readBytesPerSecond,
		WriteIOPS:           writeIOPs,
		ReadIOPS:            readIOPs,
	}
	c.cond.Broadcast()
}

func (c *IOLimiterV1) Apply(ctx context.Context, basePath, cgroupPath string) error {
	var devices []string
	for _, wc := range blockDevices {
		matches, err := filepath.Glob(filepath.Join("/sys/block", wc, "dev"))
		if err != nil {
			log.WithField("cgroupPath", cgroupPath).WithField("wc", wc).Warn("cannot glob devices")
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
	log.WithField("devices", devices).Debug("found devices")

	produceLimits := func(value int64) []string {
		lines := make([]string, 0, len(devices))
		for _, dev := range devices {
			lines = append(lines, fmt.Sprintf("%s %d", dev, value))
		}
		return lines
	}

	writeLimit := func(limitPath string, content []string) error {
		for _, l := range content {
			_, err := os.Stat(limitPath)
			if errors.Is(err, os.ErrNotExist) {
				log.WithError(err).WithField("limitPath", limitPath).Debug("blkio file does not exist")
				continue
			}

			err = os.WriteFile(limitPath, []byte(l), 0644)
			if err != nil {
				log.WithError(err).WithField("limitPath", limitPath).WithField("line", l).Warn("cannot write limit")
				continue
			}
		}
		return nil
	}

	writeLimits := func(l limits) error {
		base := filepath.Join(basePath, "blkio", cgroupPath)

		var err error
		err = writeLimit(filepath.Join(base, fnBlkioThrottleWriteBps), produceLimits(l.WriteBytesPerSecond))
		if err != nil {
			return xerrors.Errorf("cannot write %s: %w", fnBlkioThrottleWriteBps, err)
		}
		err = writeLimit(filepath.Join(base, fnBlkioThrottleReadBps), produceLimits(l.ReadBytesPerSecond))
		if err != nil {
			return xerrors.Errorf("cannot write %s: %w", fnBlkioThrottleReadBps, err)
		}
		err = writeLimit(filepath.Join(base, fnBlkioThrottleWriteIOPS), produceLimits(l.WriteIOPS))
		if err != nil {
			return xerrors.Errorf("cannot write %s: %w", fnBlkioThrottleWriteIOPS, err)
		}
		err = writeLimit(filepath.Join(base, fnBlkioThrottleReadIOPS), produceLimits(l.ReadIOPS))
		if err != nil {
			return xerrors.Errorf("cannot write %s: %w", fnBlkioThrottleReadIOPS, err)
		}

		return nil
	}

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
		log.WithField("cgroupPath", cgroupPath).Debug("starting IO limiting")
		err := writeLimits(c.limits)
		if err != nil {
			log.WithError(err).WithField("cgroupPath", cgroupPath).Error("cannot write IO limits")
		}

		for {
			select {
			case <-update:
				log.WithField("cgroupPath", cgroupPath).WithField("l", c.limits).Debug("writing new IO limiting")
				err := writeLimits(c.limits)
				if err != nil {
					log.WithError(err).WithField("cgroupPath", cgroupPath).Error("cannot write IO limits")
				}
			case <-ctx.Done():
				// Prior to shutting down though, we need to reset the IO limits to ensure we don't have
				// processes stuck in the uninterruptable "D" (disk sleep) state. This would prevent the
				// workspace pod from shutting down.
				err = writeLimits(limits{})
				if err != nil {
					log.WithError(err).WithField("cgroupPath", cgroupPath).Error("cannot reset IO limits")
				}
				log.WithField("cgroupPath", cgroupPath).Debug("stopping IO limiting")
			}
		}

	}()

	return nil
}
