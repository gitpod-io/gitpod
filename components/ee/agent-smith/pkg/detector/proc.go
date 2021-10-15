// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package detector

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/procfs"
)

var _ ProcessDetector = &ProcfsDetector{}

// ProcfsDetector detects processes and workspaces on this node by scanning procfs
type ProcfsDetector struct {
	p procfs.FS

	mu sync.RWMutex
	ps chan Process

	indexSizeGuage         prometheus.Gauge
	nearWorkspaceMissTotal prometheus.Gauge

	startOnce sync.Once
}

func NewProcfsDetector() (*ProcfsDetector, error) {
	p, err := procfs.NewFS("/proc")
	if err != nil {
		return nil, err
	}

	return &ProcfsDetector{
		indexSizeGuage: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: "gitpod",
			Subsystem: "agent_smith_procfs_detector",
			Name:      "index_size",
			Help:      "number of entries in the last procfs scan index",
		}),
		nearWorkspaceMissTotal: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: "gitpod",
			Subsystem: "agent_smith_procfs_detector",
			Name:      "near_workspace_miss",
			Help:      "total count where a process structure looked like a workspace, but did not have all environment variables",
		}),
		p: p,
	}, nil
}

func (det *ProcfsDetector) Describe(d chan<- *prometheus.Desc) {
	det.indexSizeGuage.Describe(d)
	det.nearWorkspaceMissTotal.Describe(d)
}

func (det *ProcfsDetector) Collect(m chan<- prometheus.Metric) {
	det.indexSizeGuage.Collect(m)
	det.nearWorkspaceMissTotal.Collect(m)
}

func (det *ProcfsDetector) start() {
	ps := make(chan Process, 100)
	go func() {
		t := time.NewTicker(30 * time.Second)
		defer t.Stop()

		for range t.C {
			det.run(ps)
		}
	}()
	go func() {
		for p := range ps {
			det.mu.RLock()
			if det.ps != nil {
				det.ps <- p
			}
			det.mu.RUnlock()
		}
	}()
}

func (det *ProcfsDetector) run(processes chan<- Process) {
	procs, err := det.p.AllProcs()
	if err != nil {
		log.WithError(err).Error("cannot list processes")
	}
	sort.Sort(procs)

	type process struct {
		PID       int
		Depth     int
		Path      string
		Kind      ProcessKind
		Parent    *process
		Children  []*process
		Leaf      bool
		Cmdline   []string
		Workspace *common.Workspace
	}

	idx := make(map[int]*process, len(procs))

	for _, p := range procs {
		cmdline, err := p.CmdLine()
		if err != nil {
			log.WithField("pid", p.PID).WithError(err).Debug("cannot get commandline of process")
			continue
		}
		stat, err := p.Stat()
		if err != nil {
			log.WithField("pid", p.PID).WithError(err).Debug("cannot stat process")
			continue
		}
		path, err := p.Executable()
		if err != nil {
			log.WithField("pid", p.PID).WithError(err).Debug("cannot get process executable")
			continue
		}

		// Even though we loop through a sorted process list (lowest PID first), we cannot
		// assume that we've seen the parent already due to PID reuse.
		parent, ok := idx[stat.PPID]
		if !ok {
			parent = &process{PID: stat.PPID}
			idx[parent.PID] = parent
		}
		proc, ok := idx[p.PID]
		if !ok {
			proc = &process{PID: p.PID, Leaf: true}
		}
		proc.Cmdline = cmdline
		proc.Parent = parent
		proc.Kind = ProcessUnknown
		proc.Path = path
		parent.Children = append(parent.Children, proc)
		parent.Leaf = false
		idx[p.PID] = proc
	}

	// We now have a complete view of the process table. Let's calculate the depths
	root, ok := idx[1]
	if !ok {
		log.Error("cannot find pid 1")
		return
	}
	det.indexSizeGuage.Set(float64(len(idx)))

	// let's find all workspaces, from the root down
	minWSDepth := -1
	var findWorkspaces func(p *process, d int)
	findWorkspaces = func(p *process, d int) {
		p.Depth = d
		var found bool
		if len(p.Cmdline) >= 2 && p.Cmdline[0] == "/proc/self/exe" && p.Cmdline[1] == "ring1" {
			// we've potentially found a workspacekit process, and expect it's one child to a be a supervisor process
			if len(p.Children) == 1 {
				c := p.Children[0]

				if len(c.Cmdline) == 2 && c.Cmdline[0] == "supervisor" && c.Cmdline[1] == "run" {
					// we've found the corresponding supervisor process - hence the original process must be a workspace
					p.Workspace = extractWorkspaceFromWorkspacekit(p.PID)
					if p.Workspace.WorkspaceID == "" || p.Workspace.InstanceID == "" {
						det.nearWorkspaceMissTotal.Inc()
					}
					found = true
					if minWSDepth == -1 || p.Depth < minWSDepth {
						minWSDepth = p.Depth
					}

					if p.Workspace != nil {
						// we have actually found a workspace, but extractWorkspaceFromWorkspacekit sets the PID of the workspace
						// to the PID we extracted that data from, i.e. workspacekit. We want the workspace PID to point to the
						// supervisor process, so that when we kill that process we hit supervisor, not workspacekit.
						p.Workspace.PID = c.PID
					}
				}
			}
		}
		if found {
			return
		}

		for _, c := range p.Children {
			findWorkspaces(c, d+1)
		}
	}
	findWorkspaces(root, 0)

	// we expect all workspaces to sit at the same depth in the process tree - let's filter those which are not at the minimum level
	var wss []*process
	for _, p := range idx {
		if p.Depth != minWSDepth {
			p.Workspace = nil
		}
		if p.Workspace != nil {
			wss = append(wss, p)
		}
	}

	// publish all child processes of the workspaces
	var publishProcess func(p *process)
	publishProcess = func(p *process) {
		processes <- Process{
			Path:        p.Path,
			CommandLine: p.Cmdline,
			Kind:        p.Kind,
			Workspace:   p.Workspace,
		}
		for _, c := range p.Children {
			publishProcess(c)
		}
	}
	for _, ws := range wss {
		for _, c := range ws.Children {
			publishProcess(c)
		}
	}
}

func extractWorkspaceFromWorkspacekit(pid int) *common.Workspace {
	proc, err := procfs.NewProc(pid)
	if err != nil {
		log.WithField("pid", pid).WithError(err).Debug("extractWorkspaceFromWorkspacekit: cannot get process")
		return nil
	}
	env, err := proc.Environ()
	if err != nil {
		log.WithField("pid", pid).WithError(err).Debug("extractWorkspaceFromWorkspacekit: cannot get process environment")
		return nil
	}

	var (
		ownerID, workspaceID, instanceID string
		gitURL                           string
	)
	for _, e := range env {
		if strings.HasPrefix(e, "GITPOD_OWNER_ID=") {
			ownerID = strings.TrimPrefix(e, "GITPOD_OWNER_ID=")
			continue
		}
		if strings.HasPrefix(e, "GITPOD_WORKSPACE_ID=") {
			workspaceID = strings.TrimPrefix(e, "GITPOD_WORKSPACE_ID=")
			continue
		}
		if strings.HasPrefix(e, "GITPOD_INSTANCE_ID=") {
			instanceID = strings.TrimPrefix(e, "GITPOD_INSTANCE_ID=")
			continue
		}
		if strings.HasPrefix(e, "GITPOD_WORKSPACE_CONTEXT_URL=") {
			gitURL = strings.TrimPrefix(e, "GITPOD_WORKSPACE_CONTEXT_URL=")
			continue
		}
	}
	return &common.Workspace{
		OwnerID:     ownerID,
		WorkspaceID: workspaceID,
		InstanceID:  instanceID,
		GitURL:      gitURL,
		PID:         pid,
	}
}

// DiscoverProcesses starts process discovery. Must not be called more than once.
func (det *ProcfsDetector) DiscoverProcesses(ctx context.Context) (<-chan Process, error) {
	det.mu.Lock()
	defer det.mu.Unlock()

	if det.ps != nil {
		return nil, fmt.Errorf("already discovering processes")
	}
	res := make(chan Process, 100)
	det.ps = res
	det.startOnce.Do(det.start)

	return res, nil
}
