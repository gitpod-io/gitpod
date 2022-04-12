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
	return c.writeIOMax(filepath.Join(basePath, cgroupPath))
}

func (c *IOLimiterV2) writeIOMax(loc string) error {
	iostat, err := os.ReadFile(filepath.Join(string(loc), "io.stat"))
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
