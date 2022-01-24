// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resources

import (
	"container/ring"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/shirou/gopsutil/process"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// Controller controls a container's resource use
type Controller struct {
	InstanceID     string
	CGroupBasePath string
	CGroupPath     string

	SamplingPeriod time.Duration
	ControlPeriod  time.Duration
	TimeInPeriod   time.Duration

	cpuLimiter         ResourceLimiter
	cpuLimiterOverride ResourceLimiter
	cpuPrevAcct        int64
	cpuExpenditures    *ring.Ring
	cfsController      cfsController

	processPriorities map[ProcessType]int

	Prometheus prometheus.Registerer

	mu       sync.RWMutex
	stopOnce sync.Once
	stop     chan struct{}
	log      *logrus.Entry
}

// ControllerOpt configrues a controller
type ControllerOpt func(*Controller)

// WithCGroupBasePath sets the basepath for cgroup access
func WithCGroupBasePath(base string) ControllerOpt {
	return func(g *Controller) {
		g.CGroupBasePath = base
	}
}

// WithCPULimiter sets the resource limiter for CPUs
func WithCPULimiter(l ResourceLimiter) ControllerOpt {
	return func(g *Controller) {
		g.cpuLimiter = l
	}
}

// WithGitpodIDs sets the gitpod relevant IDs
func WithGitpodIDs(workspaceID, instanceID string) ControllerOpt {
	return func(g *Controller) {
		g.log = g.log.WithFields(log.OWI("", workspaceID, instanceID))
	}
}

// WithPrometheusRegisterer configures a prometheus registry
func WithPrometheusRegisterer(reg prometheus.Registerer) ControllerOpt {
	return func(g *Controller) {
		g.Prometheus = reg
	}
}

// WithProcessPriorities enables process priority shaping
func WithProcessPriorities(prio map[ProcessType]int) ControllerOpt {
	return func(g *Controller) {
		g.processPriorities = prio
	}
}

// WithControlPeriod configures the control period of the controller
func WithControlPeriod(period time.Duration) ControllerOpt {
	return func(g *Controller) {
		g.ControlPeriod = period
	}
}

// ProcessType referes to the kinds of prioritisable processes in the cgroup
type ProcessType string

const (
	// ProcessSupervisor referes to a supervisor process
	ProcessSupervisor ProcessType = "supervisor"
	// ProcessTheia refers to Theia as process
	ProcessTheia ProcessType = "theia"
	// ProcessShell refers to user shells, e.g. bash
	ProcessShell ProcessType = "shell"
	// ProcessDefault referes to any process that is not one of the above
	ProcessDefault ProcessType = "default"
)

// NewController creates a new resource controller for a container
func NewController(containerID, instanceID string, cgroupPath string, opts ...ControllerOpt) (gov *Controller, err error) {
	gov = &Controller{
		stop:           make(chan struct{}),
		log:            log.WithField("containerID", containerID),
		CGroupPath:     cgroupPath,
		CGroupBasePath: "/sys/fs/cgroup",
		InstanceID:     instanceID,
		SamplingPeriod: 10 * time.Second,
		ControlPeriod:  15 * time.Minute,
		Prometheus:     prometheus.DefaultRegisterer,
	}
	for _, o := range opts {
		o(gov)
	}
	gov.cfsController = cgroupCFSController(filepath.Join(gov.CGroupBasePath, "cpu", gov.CGroupPath))

	sampleCount := int(gov.ControlPeriod / gov.SamplingPeriod)
	if sampleCount <= 0 {
		sampleCount = 1
	} else if sampleCount > 500 {
		// Limit the sample count to limit memory use per workspace.
		// Max sample memory use is: workspacesPerNode * sampleCount * sizeof(int) e.g. 25 * 500 * 4 = 48kb
		// 500 samples are enough to sample a 15min window at 1.8 seconds.
		sampleCount = 500
	}
	gov.cpuExpenditures = ring.New(sampleCount)

	if gov.ControlPeriod%gov.SamplingPeriod != 0 {
		return nil, xerrors.Errorf("control period must be a multiple of sampling period")
	}

	return gov, nil
}

// Start actually starts governing. This function is meant to be called as a Go-routine.
func (gov *Controller) Start(ctx context.Context) {
	t := time.NewTicker(gov.SamplingPeriod)
	for {
		gov.controlCPU()
		gov.controlProcessPriorities()

		// wait
		select {
		case <-t.C:
			continue
		case <-ctx.Done():
			gov.log.Debug("resource controller shutting down")
			return
		case <-gov.stop:
			gov.log.Debug("resource controller shutting down")
			return
		}
	}
}

func (gov *Controller) controlCPU() {
	if gov.cpuLimiter == nil {
		return
	}

	sample, err := gov.cfsController.GetUsage()
	if xerrors.Is(err, os.ErrNotExist) {
		// the cgroup doesn't exist (yet or anymore). That's ok.
		// If the cgroup doesn't exist, we don't have much to control,
		// and chances are the container isn't running anyways.
		return
	} else if err != nil {
		gov.log.WithError(err).Warn("cannot sample cpuacct.usage")
		return
	}

	prev := gov.cpuPrevAcct
	gov.cpuPrevAcct = sample
	if prev == 0 {
		// we haven't seen a sample before
		return
	}

	var bdgtSpent int64
	if prev > 0 {
		// sample and prev are total CPU time consumption at t-10sec and t.
		// diff is the total CPU time consumption during the sampling interval.
		diff := sample - prev

		gov.cpuExpenditures.Value = diff / int64(time.Millisecond)
		gov.cpuExpenditures = gov.cpuExpenditures.Next()
		gov.cpuExpenditures.Do(func(s interface{}) {
			si, ok := s.(int64)
			if !ok {
				return
			}
			bdgtSpent += si
		})
	}

	var newLimit int64

	gov.mu.RLock()
	if gov.cpuLimiterOverride != nil {
		newLimit = gov.cpuLimiterOverride.Limit(bdgtSpent)
	} else {
		newLimit = gov.cpuLimiter.Limit(bdgtSpent)
	}
	gov.mu.RUnlock()

	_, err = gov.enforceCPULimit(newLimit)
	if xerrors.Is(err, os.ErrNotExist) {
		// the cgroup doesn't exist (yet or anymore). That's ok.
		// If the cgroup doesn't exist, we don't have much to control,
		// and chances are the container isn't running anyways.
		return
	} else if err != nil {
		gov.log.WithField("newLimit", newLimit).WithField("bdgtSpent", bdgtSpent).WithField("sample", sample).WithField("prev", prev).
			WithError(err).
			Warn("cannot set new CPU limit")
		return
	}
}

// SetFixedCPULimit overrides the CPU current limiter with a fixed CPU limiter
func (gov *Controller) SetFixedCPULimit(newLimit int64) {
	gov.mu.Lock()
	defer gov.mu.Unlock()

	gov.cpuLimiterOverride = nil

	if newLimit > 0 {
		gov.cpuLimiterOverride = FixedLimiter(newLimit)
		gov.log.WithField("limit", newLimit).Debug("set fixed CPU limit for workspace")
	}
}

func (gov *Controller) controlProcessPriorities() {
	if len(gov.processPriorities) == 0 {
		return
	}

	fn := filepath.Join(gov.CGroupBasePath, "pids", gov.CGroupPath, "tasks")
	fc, err := os.ReadFile(fn)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			gov.log.WithError(err).Warn("cannot read tasks file")
		}
		return
	}

	for _, line := range strings.Split(string(fc), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		pid, err := strconv.ParseInt(line, 10, 64)
		if err != nil {
			gov.log.WithError(err).WithField("line", line).Warn("cannot parse pid")
			continue
		}

		proc, err := process.NewProcess(int32(pid))
		if err == process.ErrorProcessNotRunning {
			// we're too late - the process is already gone
			continue
		}
		if err != nil {
			gov.log.WithError(err).WithField("pid", pid).Warn("cannot get process")
			continue
		}

		tpe := determineProcessType(proc)
		prio, ok := gov.processPriorities[tpe]
		if !ok {
			continue
		}

		err = syscall.Setpriority(syscall.PRIO_PROCESS, int(pid), prio)
		if err != nil {
			gov.log.WithError(err).WithField("pid", pid).WithField("prio", prio).Warn("cannot set process priority")
		}
	}

}

type processTypeIndicator interface {
	CmdlineSlice() ([]string, error)
}

func determineProcessType(p processTypeIndicator) ProcessType {
	cmdline, err := p.CmdlineSlice()
	if err != nil || len(cmdline) == 0 {
		return ProcessDefault
	}

	cmd := cmdline[0]
	if strings.HasSuffix(cmd, "supervisor") {
		return ProcessSupervisor
	}
	if strings.HasSuffix(cmd, "gitpod-node") {
		return ProcessTheia
	}
	if cmd == "/bin/bash" {
		return ProcessShell
	}
	return ProcessDefault
}

// enforceCPULimit sets a new CPU spending limit expressed in CPU cores
func (gov *Controller) enforceCPULimit(limit int64) (didChange bool, err error) {
	currentQuota, periodInMs, err := gov.cfsController.GetQuota()
	if err != nil {
		return
	}

	newQuota := limit * (periodInMs / 100)
	if newQuota == currentQuota {
		return false, nil
	}

	err = gov.cfsController.SetQuota(newQuota)
	if err != nil {
		return
	}

	gov.log.WithField("currentQuota", currentQuota).WithField("limit", limit).WithField("quota", newQuota).Info("set new CPU limit")

	return true, nil
}

// Stop stops the controller
func (gov *Controller) Stop() {
	gov.stopOnce.Do(func() {
		close(gov.stop)
	})
}

// cfsController interacts with the completely fair scheduler of the linux kernel
type cfsController interface {
	GetUsage() (nanoSeconds int64, err error)
	GetQuota() (quota, period int64, err error)
	SetQuota(quota int64) error
}

// cgroupCFSController controls a cgroup's CFS settings
type cgroupCFSController string

// GetUsage returns the cpuacct.usage value of the cgroup
func (basePath cgroupCFSController) GetUsage() (nanoSeconds int64, err error) {
	fn := filepath.Join(string(basePath), "cpuacct.usage")
	fc, err := os.ReadFile(fn)
	if err != nil {
		return 0, xerrors.Errorf("cannot sample cpuacct.usage: %w", err)
	}

	nanoSeconds, err = strconv.ParseInt(strings.TrimSpace(string(fc)), 10, 64)
	if err != nil {
		return 0, xerrors.Errorf("cannot sample cpuacct.usage: %w", err)
	}

	return nanoSeconds, nil
}

// GetQuota returns the current quota and period setting of the cgroup's CFS
func (basePath cgroupCFSController) GetQuota() (quota, period int64, err error) {
	quotafn := filepath.Join(string(basePath), "cpu.cfs_quota_us")
	periodfn := filepath.Join(string(basePath), "cpu.cfs_period_us")

	quotafc, err := os.ReadFile(quotafn)
	if err != nil {
		err = xerrors.Errorf("cannot read CFS quota: %w", err)
		return
	}
	quota, err = strconv.ParseInt(strings.TrimSpace(string(quotafc)), 10, 64)
	if err != nil {
		err = xerrors.Errorf("cannot parse CFS quota: %w", err)
		return
	}
	periodfc, err := os.ReadFile(periodfn)
	if err != nil {
		err = xerrors.Errorf("cannot read CFS period: %w", err)
		return
	}
	period, err = strconv.ParseInt(strings.TrimSpace(string(periodfc)), 10, 64)
	if err != nil {
		err = xerrors.Errorf("cannot parse CFS period: %w", err)
		return
	}
	return
}

// SetQuota sets a new CFS quota on the cgroup
func (basePath cgroupCFSController) SetQuota(quota int64) (err error) {
	quotafn := filepath.Join(string(basePath), "cpu.cfs_quota_us")
	err = os.WriteFile(quotafn, []byte(strconv.FormatInt(quota, 10)), 0644)
	if err != nil {
		return xerrors.Errorf("cannot set CFS quota: %w", err)
	}
	return
}
