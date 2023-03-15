// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"io/ioutil"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	linuxproc "github.com/c9s/goprocinfo/linux"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	cgroups "github.com/gitpod-io/gitpod/common-go/cgroups/v2"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
)

type TopService struct {
	data      *api.ResourcesStatusResponse
	ready     chan struct{}
	readyOnce sync.Once
	top       func(ctx context.Context) (*api.ResourcesStatusResponse, error)
}

func NewTopService() *TopService {
	log.Debug("gitpod top service: initialized")
	return &TopService{
		top: Top,
	}
}

// Observe starts observing the resource status
func (t *TopService) Observe(ctx context.Context) {
	var (
		delay                       = 1 * time.Second
		reconnectionDelayGrowFactor = 1.5
		minReconnectionDelay        = 1 * time.Second
		maxReconnectionDelay        = 30 * time.Second
	)

	t.ready = make(chan struct{})

	go func() {
		for {
			data, err := t.top(ctx)
			if err == nil {
				delay = minReconnectionDelay
				t.data = data

				t.readyOnce.Do(func() {
					close(t.ready)
				})
			} else if ctx.Err() == nil {
				log.WithField("error", err).Errorf("failed to retrieve resource status from upstream, trying again in %d seconds...", uint32(delay.Seconds()))
			}
			select {
			case <-ctx.Done():
				log.Info("Resource Status observer stopped")
				return
			case <-time.After(delay):
				delay = time.Duration(float64(delay) * reconnectionDelayGrowFactor)
				if delay > maxReconnectionDelay {
					delay = maxReconnectionDelay
				}
			}
		}
	}()
}

func calcSeverity(value int64) api.ResourceStatusSeverity {
	switch {
	case value >= 95:
		return api.ResourceStatusSeverity_danger
	case value >= 80:
		return api.ResourceStatusSeverity_warning
	default:
		return api.ResourceStatusSeverity_normal
	}
}

// Top provides workspace resources status information.
func Top(ctx context.Context) (*api.ResourcesStatusResponse, error) {
	const socketFN = "/.supervisor/info.sock"

	if _, err := os.Stat(socketFN); os.IsNotExist(err) {
		memory, err := resolveMemoryStatus()
		if err != nil {
			return nil, err
		}
		cpu, err := resolveCPUStatus()
		if err != nil {
			return nil, err
		}

		cpuPercentage := int64((float64(cpu.Used) / float64(cpu.Limit)) * 100)
		memoryPercentage := int64((float64(memory.Used) / float64(memory.Limit)) * 100)

		cpu.Severity = calcSeverity(cpuPercentage)
		memory.Severity = calcSeverity(memoryPercentage)

		return &api.ResourcesStatusResponse{
			Memory: memory,
			Cpu:    cpu,
		}, nil
	} else {
		conn, err := grpc.DialContext(ctx, "unix://"+socketFN, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return nil, xerrors.Errorf("could not dial context: %w", err)
		}
		defer conn.Close()

		client := daemonapi.NewWorkspaceInfoServiceClient(conn)
		resp, err := client.WorkspaceInfo(ctx, &daemonapi.WorkspaceInfoRequest{})
		if err != nil {
			return nil, xerrors.Errorf("could not retrieve workspace info: %w", err)
		}

		cpuPercentage := int64((float64(resp.Resources.Cpu.Used) / float64(resp.Resources.Cpu.Limit)) * 100)
		memoryPercentage := int64((float64(resp.Resources.Memory.Used) / float64(resp.Resources.Memory.Limit)) * 100)

		return &api.ResourcesStatusResponse{
			Memory: &api.ResourceStatus{
				Limit:    resp.Resources.Memory.Limit,
				Used:     resp.Resources.Memory.Used,
				Severity: calcSeverity(memoryPercentage),
			},
			Cpu: &api.ResourceStatus{
				Limit:    resp.Resources.Cpu.Limit,
				Used:     resp.Resources.Cpu.Used,
				Severity: calcSeverity(cpuPercentage),
			},
		}, nil
	}
}

func resolveMemoryStatus() (*api.ResourceStatus, error) {
	memory := cgroups.NewMemoryController("/sys/fs/cgroup")

	limit, err := memory.Max()
	if err != nil {
		return nil, xerrors.Errorf("failed to parse memory.max: %w", err)
	}

	memInfo, err := linuxproc.ReadMemInfo("/proc/meminfo")
	if err != nil {
		return nil, xerrors.Errorf("failed to read meminfo: %w", err)
	}

	memTotal := memInfo.MemTotal * 1024
	if limit > memTotal && memTotal > 0 {
		limit = memTotal
	}

	used, err := memory.Current()
	if err != nil {
		return nil, xerrors.Errorf("failed to parse memory.current: %w", err)
	}

	memstats, err := memory.Stat()
	if err != nil {
		return nil, xerrors.Errorf("failed to parse memory.stats: %w", err)
	}

	if used < memstats.InactiveFileTotal {
		used = 0
	} else {
		used -= memstats.InactiveFileTotal
	}

	return &api.ResourceStatus{
		Limit: int64(limit),
		Used:  int64(used),
	}, nil
}

func resolveCPUStatus() (*api.ResourceStatus, error) {
	t, err := resolveCPUStat()
	if err != nil {
		return nil, err
	}

	time.Sleep(time.Second)

	t2, err := resolveCPUStat()
	if err != nil {
		return nil, err
	}

	cpuUsage := t2.usage - t.usage
	totalTime := t2.uptime - t.uptime
	used := cpuUsage / totalTime * 1000

	content, err := ioutil.ReadFile("/sys/fs/cgroup/cpu/cpu.cfs_quota_us")
	if err != nil {
		return nil, xerrors.Errorf("failed to read cpu.cfs_quota_us: %w", err)
	}
	quota, err := strconv.Atoi(strings.TrimSpace(string(content)))
	if err != nil {
		return nil, xerrors.Errorf("failed to parse cpu.cfs_quota_us: %w", err)
	}

	var limit int
	if quota > 0 {
		content, err = ioutil.ReadFile("/sys/fs/cgroup/cpu/cpu.cfs_period_us")
		if err != nil {
			return nil, xerrors.Errorf("failed to read cpu.cfs_period_us: %w", err)
		}
		period, err := strconv.Atoi(strings.TrimSpace(string(content)))
		if err != nil {
			return nil, xerrors.Errorf("failed to parse cpu.cfs_period_us: %w", err)
		}

		limit = quota / period * 1000
	} else {
		content, err = ioutil.ReadFile("/sys/fs/cgroup/cpu/cpuacct.usage_percpu")
		if err != nil {
			return nil, xerrors.Errorf("failed to read cpuacct.usage_percpu: %w", err)
		}
		limit = len(strings.Split(strings.TrimSpace(string(content)), " ")) * 1000
	}

	return &api.ResourceStatus{
		Limit: int64(limit),
		Used:  int64(used),
	}, nil
}

type cpuStat struct {
	usage  float64
	uptime float64
}

func resolveCPUStat() (*cpuStat, error) {
	cpu := cgroups.NewCpuController("/sys/fs/cgroups")

	stats, err := cpu.Stat()
	if err != nil {
		return nil, xerrors.Errorf("failed to parse cpu.stat: %w", err)
	}

	usage := float64(stats.UsageTotal) * 1e-9

	uptime, err := readProcUptime()
	if err != nil {
		return nil, xerrors.Errorf("failed to parse uptime: %w", err)
	}

	return &cpuStat{
		usage:  usage,
		uptime: uptime,
	}, nil
}

func readProcUptime() (float64, error) {
	content, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, xerrors.Errorf("failed to read uptime: %w", err)
	}
	values := strings.Split(strings.TrimSpace(string(content)), " ")
	uptime, err := strconv.ParseFloat(values[0], 64)
	if err != nil {
		return 0, xerrors.Errorf("failed to parse uptime: %w", err)
	}

	return uptime, nil
}
