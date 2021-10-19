// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package detector

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cespare/xxhash/v2"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/common-go/log"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/procfs"
)

type discoverableProcFS interface {
	Discover() map[int]*process
	Environ(pid int) ([]string, error)
}

type realProcfs procfs.FS

var _ discoverableProcFS = realProcfs{}

func (fs realProcfs) Discover() map[int]*process {
	proc := procfs.FS(fs)
	procs, err := proc.AllProcs()
	if err != nil {
		log.WithError(err).Error("cannot list processes")
	}
	sort.Sort(procs)

	idx := make(map[int]*process, len(procs))

	digest := make([]byte, 24)
	for _, p := range procs {
		cmdline, err := p.CmdLine()
		if err != nil {
			log.WithField("pid", p.PID).WithError(err).Debug("cannot get commandline of process")
			continue
		}
		stat, err := statProc(p.PID)
		if err != nil {
			log.WithField("pid", p.PID).WithError(err).Debug("cannot stat process")
			continue
		}
		// Note: don't use p.Executable() here because it resolves the exe symlink which yields
		//       a path that doesn't make sense in this mount namespace. However, reading from this
		//       file directly works.
		path := filepath.Join("proc", strconv.Itoa(p.PID), "exe")

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

		binary.LittleEndian.PutUint64(digest[0:8], uint64(p.PID))
		binary.LittleEndian.PutUint64(digest[8:16], uint64(stat.PPID))
		binary.LittleEndian.PutUint64(digest[16:24], stat.Starttime)
		proc.Hash = xxhash.Sum64(digest)

		idx[p.PID] = proc
	}
	return idx
}

type stat struct {
	PPID      int
	Starttime uint64
}

// statProc returns a limited set of /proc/<pid>/stat content.
func statProc(pid int) (*stat, error) {
	f, err := os.Open(fmt.Sprintf("/proc/%d/stat", pid))
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return parseStat(f)
}

func parseStat(r io.Reader) (res *stat, err error) {
	var (
		ppid      uint64
		starttime uint64
		i         = -1
	)

	scan := bufio.NewScanner(r)
	// We use a fixed buffer size assuming that none of the env vars we're interested in is any larger.
	// This is part of the trick to keep allocs down.
	scan.Buffer(make([]byte, 512), 512)
	scan.Split(scanFixedSpace(512))
	for scan.Scan() {
		text := scan.Bytes()
		if text[len(text)-1] == ')' {
			i = 0
		}

		if i == 2 {
			ppid, err = strconv.ParseUint(string(text), 10, 64)
		}
		if i == 20 {
			starttime, err = strconv.ParseUint(string(text), 10, 64)
		}
		if err != nil {
			return
		}

		if i >= 0 {
			i++
		}
	}
	if err := scan.Err(); err != nil {
		return nil, err
	}

	if ppid == 0 || starttime == 0 {
		return nil, fmt.Errorf("cannot parse stat")
	}

	return &stat{
		PPID:      int(ppid),
		Starttime: starttime,
	}, nil
}

func (p realProcfs) Environ(pid int) ([]string, error) {
	// Note: procfs.Environ is too expensive becuase it uses io.ReadAll which leaks
	//       memory over time.

	f, err := os.Open(fmt.Sprintf("/proc/%d/environ", pid))
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return parseGitpodEnviron(f)
}

func parseGitpodEnviron(r io.Reader) ([]string, error) {
	// Note: this function is benchmarked in BenchmarkParseGitPodEnviron.
	//       At the time of this wriging it consumed 3+N allocs where N is the number of
	//       env vars starting with GITPOD_.
	//
	// When making changes to this function, ensure you're not causing more allocs
	// which could have a too drastic resource usage effect in prod.

	scan := bufio.NewScanner(r)
	// We use a fixed buffer size assuming that none of the env vars we're interested in is any larger.
	// This is part of the trick to keep allocs down.
	scan.Buffer(make([]byte, 512), 512)
	scan.Split(scanNullTerminatedLines(512))

	// we expect at least 10 relevant env vars
	res := make([]string, 0, 10)
	for scan.Scan() {
		// we only keep GITPOD_ variables for optimisation
		text := scan.Bytes()
		if !bytes.HasPrefix(text, []byte("GITPOD_")) {
			continue
		}

		res = append(res, string(text))
	}
	return res, nil
}

func scanNullTerminatedLines(fixedBufferSize int) func(data []byte, atEOF bool) (advance int, token []byte, err error) {
	return func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := bytes.IndexByte(data, 0); i >= 0 {
			// We have a full null-terminated line.
			return i + 1, data[:i], nil
		}
		// If we're at EOF, we have a final, non-terminated line. Return it.
		if atEOF {
			return len(data), data, nil
		}
		if len(data) == 512 {
			return len(data), data, nil
		}
		// Request more data.
		return 0, nil, nil
	}
}

func scanFixedSpace(fixedBufferSize int) func(data []byte, atEOF bool) (advance int, token []byte, err error) {
	// The returned function behaves like bufio.ScanLines except that it doesn't try to
	// request lines longer than fixedBufferSize.
	return func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := bytes.IndexByte(data, ' '); i >= 0 {
			// We have a full null-terminated line.
			return i + 1, data[:i], nil
		}
		// If we're at EOF, we have a final, non-terminated line. Return it.
		if atEOF {
			return len(data), data, nil
		}
		if len(data) == 512 {
			return len(data), data, nil
		}
		// Request more data.
		return 0, nil, nil
	}
}

var _ ProcessDetector = &ProcfsDetector{}

// ProcfsDetector detects processes and workspaces on this node by scanning procfs
type ProcfsDetector struct {
	mu sync.RWMutex
	ps chan Process

	indexSizeGuage     prometheus.Gauge
	cacheUseCounterVec *prometheus.CounterVec

	startOnce sync.Once

	proc  discoverableProcFS
	cache *lru.Cache
}

func NewProcfsDetector() (*ProcfsDetector, error) {
	p, err := procfs.NewFS("/proc")
	if err != nil {
		return nil, err
	}

	cache, err := lru.New(2000)
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
		cacheUseCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "gitpod",
			Subsystem: "agent_smith_procfs_detector",
			Name:      "cache_use_total",
			Help:      "process cache statistics",
		}, []string{"use"}),
		proc:  realProcfs(p),
		cache: cache,
	}, nil
}

func (det *ProcfsDetector) Describe(d chan<- *prometheus.Desc) {
	det.indexSizeGuage.Describe(d)
	det.cacheUseCounterVec.Describe(d)
}

func (det *ProcfsDetector) Collect(m chan<- prometheus.Metric) {
	det.indexSizeGuage.Collect(m)
	det.cacheUseCounterVec.Collect(m)
}

func (det *ProcfsDetector) start() {
	ps := make(chan Process, 100)
	go func() {
		t := time.NewTicker(30 * time.Second)
		defer t.Stop()

		for {
			det.run(ps)
			<-t.C
		}
	}()
	go func() {
		for p := range ps {
			det.ps <- p
		}
	}()
	log.Info("procfs detector started")
}

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
	Hash      uint64
}

func (det *ProcfsDetector) run(processes chan<- Process) {
	log.Debug("procfs detector run")
	idx := det.proc.Discover()

	// We now have a complete view of the process table. Let's calculate the depths
	root, ok := idx[1]
	if !ok {
		log.Error("cannot find pid 1")
		return
	}
	det.indexSizeGuage.Set(float64(len(idx)))

	// let's find all workspaces, from the root down
	findWorkspaces(det.proc, root, 0, nil)

	for _, p := range idx {
		if p.Workspace == nil {
			continue
		}
		if p.Kind != ProcessUserWorkload {
			continue
		}
		if _, ok := det.cache.Get(p.Hash); ok {
			det.cacheUseCounterVec.WithLabelValues("hit").Inc()
			continue
		}
		det.cacheUseCounterVec.WithLabelValues("miss").Inc()
		det.cache.Add(p.Hash, struct{}{})

		proc := Process{
			Path:        p.Path,
			CommandLine: p.Cmdline,
			Kind:        p.Kind,
			Workspace:   p.Workspace,
		}
		log.WithField("proc", proc).Debug("found process")
		processes <- proc
	}
}

func findWorkspaces(proc discoverableProcFS, p *process, d int, ws *common.Workspace) {
	p.Depth = d
	p.Workspace = ws
	if ws == nil {
		p.Kind = ProcessUnknown

		if len(p.Cmdline) >= 2 && p.Cmdline[0] == "/proc/self/exe" && p.Cmdline[1] == "ring1" {
			// we've potentially found a workspacekit process, and expect it's one child to a be a supervisor process
			if len(p.Children) == 1 {
				c := p.Children[0]

				if isSupervisor(c.Cmdline) {
					// we've found the corresponding supervisor process - hence the original process must be a workspace
					p.Workspace = extractWorkspaceFromWorkspacekit(proc, p.PID)

					if p.Workspace != nil {
						// we have actually found a workspace, but extractWorkspaceFromWorkspacekit sets the PID of the workspace
						// to the PID we extracted that data from, i.e. workspacekit. We want the workspace PID to point to the
						// supervisor process, so that when we kill that process we hit supervisor, not workspacekit.
						p.Workspace.PID = c.PID
						p.Kind = ProcessSandbox
						c.Kind = ProcessSupervisor
					}
				}
			}
		}
	} else if isSupervisor(p.Cmdline) {
		p.Kind = ProcessSupervisor
	} else {
		p.Kind = ProcessUserWorkload
	}

	for _, c := range p.Children {
		findWorkspaces(proc, c, d+1, p.Workspace)
	}
}

func isSupervisor(cmdline []string) bool {
	return len(cmdline) == 2 && cmdline[0] == "supervisor" && cmdline[1] == "run"
}

func extractWorkspaceFromWorkspacekit(proc discoverableProcFS, pid int) *common.Workspace {
	env, err := proc.Environ(pid)
	if err != nil {
		log.WithError(err).Debug("cannot get environment from process - might have missed a workspace")
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
