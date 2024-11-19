// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/process"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// ProcessType referes to the kinds of prioritisable processes in the cgroup
type ProcessType string

const (
	ProcessWorkspaceKit ProcessType = "workspacekit"
	// ProcessSupervisor referes to a supervisor process
	ProcessSupervisor ProcessType = "supervisor"
	// ProcessIDE refers to node.js IDE process
	ProcessIDE ProcessType = "ide"
	// ProcessWebIDEHelper refers to VS Code Browser process
	ProcessWebIDEHelper ProcessType = "ide-helper"
	// ProcessCodeServer refers to VS Code Desktop IDE process
	ProcessCodeServer ProcessType = "vscode-server"
	// ProcessCodeServerHelper refers to VS Code Desktop child process
	ProcessCodeServerHelper ProcessType = "vscode-server-helper"
	// ProcessJetBrainsIDE refers to JetBrains IDE process
	ProcessJetBrainsIDE ProcessType = "jetbrains-ide"
	// ProcessDefault referes to any process that is not one of the above
	ProcessDefault ProcessType = "default"

	// Repeat applying until this number of processes is reached
	NumberOfProcessesToStopApplying = 5
)

type OOMScoreAdjConfig struct {
	Enabled bool `json:"enabled"`
	Tier1   int  `json:"tier1"`
	Tier2   int  `json:"tier2"`
}

type ProcessPriorityV2 struct {
	ProcessPriorities map[ProcessType]int
	OOMScoreAdj       map[ProcessType]int
	EnableOOMScoreAdj bool
}

func (c *ProcessPriorityV2) Name() string  { return "process-priority-v2" }
func (c *ProcessPriorityV2) Type() Version { return Version2 }

func (c *ProcessPriorityV2) Apply(ctx context.Context, opts *PluginOptions) error {
	fullCgroupPath := filepath.Join(opts.BasePath, opts.CgroupPath)

	t := time.NewTicker(10 * time.Second)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
		}

		data, err := ioutil.ReadFile(filepath.Join(fullCgroupPath, "workspace", "user", "cgroup.procs"))
		if errors.Is(err, fs.ErrNotExist) {
			// the target cgroup/workspace has gone
			return nil
		} else if err != nil {
			log.WithFields(log.OWI("", "", opts.InstanceId)).WithField("path", fullCgroupPath).WithError(err).Errorf("cannot read cgroup.procs file")
			return err
		}

		var countRunningProcess int
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if len(line) == 0 {
				continue
			}

			pid, err := strconv.ParseInt(line, 10, 64)
			if err != nil {
				log.WithError(err).WithFields(log.OWI("", "", opts.InstanceId)).WithField("line", line).Warn("cannot parse pid")
				continue
			}

			proc, err := process.NewProcess(int32(pid))
			if err != nil {
				if errors.Is(err, process.ErrorProcessNotRunning) {
					continue
				}

				log.WithError(err).WithFields(log.OWI("", "", opts.InstanceId)).WithField("pid", pid).Warn("cannot get process")
				continue
			}

			procType := determineProcessType(proc)
			if procType == ProcessDefault {
				continue
			}

			c.adaptProcessPriorites(procType, pid)
			if c.EnableOOMScoreAdj {
				c.adaptOOMScore(procType, pid)
			}
		}

		if countRunningProcess >= NumberOfProcessesToStopApplying {
			return nil
		}
	}
}

var (
	vsCodeNodeRegex = regexp.MustCompile("/home/gitpod/.vscode-server/bin/.*/node")
	jetBrainsRegex  = regexp.MustCompile("/ide-desktop/.*/backend/plugins/remote-dev-server/selfcontained/lib")
)

func determineProcessType(p *process.Process) ProcessType {
	cmd := extractCommand(p)
	if len(cmd) == 0 {
		return ProcessDefault
	}

	if strings.HasSuffix(cmd[0], "workspacekit") || (len(cmd) >= 2 && cmd[1] == "ring1") {
		return ProcessWorkspaceKit
	}

	if strings.HasSuffix(cmd[0], "supervisor") {
		return ProcessSupervisor
	}

	if strings.HasSuffix(cmd[0], "/bin/code-server") {
		return ProcessCodeServer
	}

	if vsCodeNodeRegex.MatchString(cmd[0]) {
		return ProcessCodeServerHelper
	}

	if strings.HasSuffix(cmd[0], "/ide/bin/gitpod-code") {
		return ProcessIDE
	}

	if strings.HasSuffix(cmd[0], "/ide/node") {
		return ProcessWebIDEHelper
	}

	if jetBrainsRegex.MatchString(strings.Join(cmd, " ")) {
		return ProcessJetBrainsIDE
	}

	return ProcessDefault
}

func extractCommand(p *process.Process) []string {
	if p == nil {
		return []string{}
	}

	cmdLine, err := p.CmdlineSlice()
	if err != nil {
		return []string{}
	}

	if len(cmdLine) == 0 {
		return []string{}
	}

	cmd := cmdLine[0]
	if cmd == "/bin/bash" || cmd == "sh" {
		return cmdLine[1:]
	}

	return cmdLine
}

func (c *ProcessPriorityV2) adaptProcessPriorites(procType ProcessType, pid int64) {
	priority, ok := c.ProcessPriorities[procType]
	if !ok {
		return
	}

	err := syscall.Setpriority(syscall.PRIO_PROCESS, int(pid), priority)
	if err != nil {
		log.WithError(err).WithField("pid", pid).WithField("priority", priority).Warn("cannot set process priority")
	}
}

func (c *ProcessPriorityV2) adaptOOMScore(procType ProcessType, pid int64) {
	oomScoreAdj, ok := c.OOMScoreAdj[procType]
	if !ok {
		return
	}

	err := os.WriteFile(fmt.Sprintf("/proc/%v/oom_score_adj", pid), []byte(strconv.Itoa(oomScoreAdj)), 0644)
	if err != nil {
		log.WithError(err).WithField("pid", pid).WithField("oomScoreAdj", oomScoreAdj).Warn("cannot set oomScoreAdj")
	}
}
