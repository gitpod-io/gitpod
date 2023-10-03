// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/containerd/cgroups"
	v2 "github.com/containerd/cgroups/v2"
)

const DefaultMountPoint = "/sys/fs/cgroup"

func IsUnifiedCgroupSetup() (bool, error) {
	return cgroups.Mode() == cgroups.Unified, nil
}

func EnsureCpuControllerEnabled(basePath, cgroupPath string) error {
	c, err := v2.NewManager(basePath, cgroupPath, &v2.Resources{})
	if err != nil {
		return err
	}

	err = c.ToggleControllers([]string{"cpu"}, v2.Enable)
	if err != nil {
		return err
	}

	return nil
}

type CpuStats struct {
	UsageTotal  uint64
	UsageUser   uint64
	UsageSystem uint64
}

type MemoryStats struct {
	InactiveFileTotal uint64
}

func ReadSingleValue(path string) (uint64, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}

	value := strings.TrimSpace(string(content))
	if value == "max" || value == "-1" {
		return math.MaxUint64, nil
	}

	max, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, err
	}

	return max, nil
}

func ReadFlatKeyedFile(path string) (map[string]uint64, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	entries := strings.Split(strings.TrimSpace(string(content)), "\n")
	kv := make(map[string]uint64, len(entries))
	for _, entry := range entries {
		tokens := strings.Split(entry, " ")
		if len(tokens) < 2 {
			continue
		}
		v, err := strconv.ParseUint(tokens[1], 10, 64)
		if err != nil {
			continue
		}
		kv[tokens[0]] = v
	}

	return kv, nil
}

// Read the total stalled time in microseconds for full and some
// It is not necessary to read avg10, avg60 and avg300 as these
// are only for convenience. They are calculated as the rate during
// the desired time frame.
func ReadPSIValue(path string) (PSI, error) {
	file, err := os.Open(path)
	if err != nil {
		return PSI{}, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var psi PSI
	for scanner.Scan() {
		line := scanner.Text()
		if err = scanner.Err(); err != nil {
			return PSI{}, fmt.Errorf("could not read psi file: %w", err)
		}

		i := strings.LastIndex(line, "total=")
		if i == -1 {
			return PSI{}, fmt.Errorf("could not find total stalled time")
		}

		total, err := strconv.ParseUint(line[i+6:], 10, 64)
		if err != nil {
			return PSI{}, fmt.Errorf("could not parse total stalled time: %w", err)
		}

		if strings.HasPrefix(line, "some") {
			psi.Some = total
		}

		if strings.HasPrefix(line, "full") {
			psi.Full = total
		}
	}

	return psi, nil
}

type PSI struct {
	Some uint64
	Full uint64
}

var (
	deviceIORegex = regexp.MustCompile(`([0-9]+):([0-9]+) rbps=([0-9]+) wbps=([0-9]+)`)
)

type DeviceIOMax struct {
	Major uint64
	Minor uint64
	Read  uint64
	Write uint64
}

func ReadIOMax(path string) ([]DeviceIOMax, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var devices []DeviceIOMax
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		matches := deviceIORegex.FindStringSubmatch(line)
		if len(matches) != 5 {
			return nil, fmt.Errorf("invalid line in %s: %s", path, line)
		}

		major, err := strconv.ParseUint(matches[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("cannot parse major number: %w", err)
		}
		minor, err := strconv.ParseUint(matches[2], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("cannot parse minor number: %w", err)
		}
		read, err := strconv.ParseUint(matches[3], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("cannot parse read bytes: %w", err)
		}
		write, err := strconv.ParseUint(matches[4], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("cannot parse write bytes: %w", err)
		}
		devices = append(devices, DeviceIOMax{
			Major: major,
			Minor: minor,
			Read:  read,
			Write: write,
		})
	}

	return devices, nil
}
