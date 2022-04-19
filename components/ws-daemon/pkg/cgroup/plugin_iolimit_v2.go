// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var clearLimits = ioLimitOptions{
	WriteBytesPerSecond: 0,
	ReadBytesPerSecond:  0,
	WriteIOPs:           0,
	ReadIOPs:            0,
}

type ioLimitOptions struct {
	WriteBytesPerSecond int64
	ReadBytesPerSecond  int64
	WriteIOPs           int64
	ReadIOPs            int64
}

type IOLimiterV2 struct {
	limits ioLimitOptions
}

func NewIOLimiterV2(writeBytesPerSecond, readBytesPerSecond, writeIOPs, readIOPs int64) *IOLimiterV2 {
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
	go func() {
		log.WithField("cgroupPath", cgroupPath).Debug("starting io limiting")
		// We are racing workspacekit and the interaction with disks.
		// If we did this just once there's a chance we haven't interacted with all
		// devices yet, and hence would not impose IO limits on them.
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		ioMaxFile := filepath.Join(basePath, cgroupPath)

		for {
			select {
			case <-ctx.Done():
				// Prior to shutting down though, we need to reset the IO limits to ensure we don't have
				// processes stuck in the uninterruptable "D" (disk sleep) state. This would prevent the
				// workspace pod from shutting down.

				err := c.writeIOMax(ioMaxFile, clearLimits)
				if err != nil {
					log.WithError(err).WithField("cgroupPath", cgroupPath).Error("cannot write IO limits")
				}
				log.WithField("cgroupPath", cgroupPath).Debug("stopping io limiting")
				return
			case <-ticker.C:
				err := c.writeIOMax(ioMaxFile, c.limits)
				if err != nil {
					log.WithError(err).WithField("cgroupPath", cgroupPath).Error("cannot write IO limits")
				}
			}
		}
	}()
	return nil
}

func (c *IOLimiterV2) writeIOMax(cgroupPath string, options ioLimitOptions) error {
	iostat, err := os.ReadFile(filepath.Join(string(cgroupPath), "io.stat"))
	if os.IsNotExist(err) {
		// cgroup gone is ok due to the dispatch/container race
		return nil
	}

	if err != nil {
		return err
	}

	// 8 block	SCSI disk devices (0-15)
	// 9 char	SCSI tape devices
	// 9 block	Metadisk (RAID) devices
	// source https://www.kernel.org/doc/Documentation/admin-guide/devices.txt
	var classesToLimit = []string{"8", "9"}
	var devs []string
	for _, line := range strings.Split(string(iostat), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 1 {
			continue
		}

		for _, class := range classesToLimit {
			if strings.HasPrefix(fields[0], fmt.Sprintf("%v:", class)) {
				devs = append(devs, fields[0])
			}
		}
	}

	ioMaxPath := filepath.Join(string(cgroupPath), "io.max")
	for _, dev := range devs {
		limit := fmt.Sprintf(
			"%s wbps=%s rbps=%s wiops=%s riops=%s",
			dev,
			getLimit(options.WriteBytesPerSecond),
			getLimit(options.ReadBytesPerSecond),
			getLimit(options.WriteIOPs),
			getLimit(options.ReadIOPs),
		)

		log.WithField("limit", limit).WithField("ioMaxPath", ioMaxPath).Debug("creating io.max limit")
		err := os.WriteFile(ioMaxPath, []byte(limit), 0644)
		if err != nil {
			log.WithField("dev", dev).WithError(err).Warn("cannot write io.max")
		}
	}

	return nil
}

func getLimit(v int64) string {
	if v <= 0 {
		return "max"
	}
	return fmt.Sprintf("%d", v)
}
