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

type IOLimiterV2 struct {
	WriteBytesPerSecond int64
	ReadBytesPerSecond  int64
	ReadIOPs            int64
	WriteIOPs           int64
}

func (c *IOLimiterV2) Name() string  { return "iolimiter-v2" }
func (c *IOLimiterV2) Type() Version { return Version2 }

func (c *IOLimiterV2) Apply(ctx context.Context, basePath, cgroupPath string) error {
	// We are racing workspacekit and the interaction with disks.
	// If we did this just once there's a chance we haven't interacted with all
	// devices yet, and hence would not impose IO limits on them.
	log.Warn("Applying io limiting")
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Warn("Workspace is gone. IO limiting can be stopped")
			// Prior to shutting down though, we need to reset the IO limits to ensure we don't have
			// processes stuck in the uninterruptable "D" (disk sleep) state. This would prevent the
			// workspace pod from shutting down.
			c.WriteBytesPerSecond = 0
			c.ReadBytesPerSecond = 0
			c.WriteIOPs = 0
			c.ReadIOPs = 0

			err := c.writeIOMax(filepath.Join(basePath, cgroupPath))
			if err != nil {
				return err
			}
			return ctx.Err()
		case <-ticker.C:
			log.Warnf("Writing IO max to %s", filepath.Join(basePath, cgroupPath))
			err := c.writeIOMax(filepath.Join(basePath, cgroupPath))
			if err != nil {
				log.WithError(err).WithField("cgroupPath", cgroupPath).Error("cannot write IO limits")
			}
		}
	}
}

func (c *IOLimiterV2) writeIOMax(loc string) error {
	iostat, err := os.ReadFile(filepath.Join(string(loc), "io.stat"))
	if os.IsNotExist(err) {
		log.Error("Pod is gone")
		// cgroup gone is ok due to the dispatch/container race
		return nil
	}
	if err != nil {
		return err
	}
	var devs []string
	for _, line := range strings.Split(string(iostat), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 1 {
			continue
		}
		devs = append(devs, fields[0])
	}

	cpuMaxPath := filepath.Join(string(loc), "io.max")
	for _, dev := range devs {
		err := os.WriteFile(cpuMaxPath, []byte(fmt.Sprintf(
			"%s wbps=%s rbps=%s wiops=%s riops=%s",
			dev,
			getLimit(c.WriteBytesPerSecond),
			getLimit(c.ReadBytesPerSecond),
			getLimit(c.WriteIOPs),
			getLimit(c.ReadIOPs),
		)), 0644)
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
