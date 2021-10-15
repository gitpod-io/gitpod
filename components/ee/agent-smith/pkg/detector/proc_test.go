// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package detector

import (
	"fmt"
	"sort"
	"sync"
	"testing"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/google/go-cmp/cmp"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/procfs"
)

type memoryProcEntry struct {
	P   *process
	Env []string
}

type memoryProc map[int]memoryProcEntry

func (p memoryProc) Discover() map[int]*process {
	res := make(map[int]*process, len(p))
	for k, v := range p {
		res[k] = v.P
	}
	return res
}

func (p memoryProc) Environ(pid int) ([]string, error) {
	proc, ok := p[pid]
	if !ok {
		return nil, fmt.Errorf("process does not exist")
	}
	return proc.Env, nil
}

var ws = &common.Workspace{WorkspaceID: "foobar", InstanceID: "baz", PID: 3}

func TestFindWorkspaces(t *testing.T) {
	ws5 := &common.Workspace{WorkspaceID: "bla", InstanceID: "blabla", PID: 5}
	ws7 := &common.Workspace{WorkspaceID: "second-ws", InstanceID: "second-ws", PID: 7}

	type WorkspaceAndDepth struct {
		W   *common.Workspace
		K   ProcessKind
		C   string
		D   int
		PID int
	}
	tests := []struct {
		Name        string
		Proc        memoryProc
		Expectation []WorkspaceAndDepth
	}{
		{
			Name: "happy path",
			Proc: (func() memoryProc {
				res := make(map[int]memoryProcEntry)
				res[1] = memoryProcEntry{P: &process{PID: 1}}
				res[2] = memoryProcEntry{
					P:   &process{PID: 2, Parent: res[1].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=foobar", "GITPOD_INSTANCE_ID=baz"},
				}
				res[3] = memoryProcEntry{P: &process{PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "run"}}}
				res[1].P.Children = []*process{res[2].P}
				res[2].P.Children = []*process{res[3].P}
				return res
			})(),
			Expectation: []WorkspaceAndDepth{
				{PID: 2, D: 1, K: ProcessSandbox, C: "/proc/self/exe", W: ws},
				{PID: 3, D: 2, K: ProcessSupervisor, C: "supervisor", W: ws},
			},
		},
		{
			Name: "mixed depths",
			Proc: (func() memoryProc {
				res := make(map[int]memoryProcEntry)
				res[1] = memoryProcEntry{P: &process{PID: 1}}
				res[2] = memoryProcEntry{
					P:   &process{PID: 2, Parent: res[1].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=foobar", "GITPOD_INSTANCE_ID=baz"},
				}
				res[3] = memoryProcEntry{P: &process{PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "run"}}}
				res[1].P.Children = []*process{res[2].P}
				res[2].P.Children = []*process{res[3].P}

				res[4] = memoryProcEntry{
					P:   &process{PID: 4, Parent: res[3].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=bla", "GITPOD_INSTANCE_ID=blabla"},
				}
				res[5] = memoryProcEntry{P: &process{PID: 5, Parent: res[4].P, Cmdline: []string{"supervisor", "run"}}}
				res[3].P.Children = []*process{res[4].P}
				res[4].P.Children = []*process{res[5].P}

				return res
			})(),
			Expectation: []WorkspaceAndDepth{
				{PID: 2, D: 1, K: ProcessSandbox, C: "/proc/self/exe", W: ws},
				{PID: 3, D: 2, K: ProcessSupervisor, C: "supervisor", W: ws},
				{PID: 4, D: 3, K: ProcessUserWorkload, C: "/proc/self/exe", W: ws},
				{PID: 5, D: 4, K: ProcessSupervisor, C: "supervisor", W: ws},
			},
		},
		{
			Name: "depper workspace",
			Proc: (func() memoryProc {
				res := make(map[int]memoryProcEntry)
				res[1] = memoryProcEntry{P: &process{PID: 1}}
				res[2] = memoryProcEntry{
					P: &process{PID: 2, Parent: res[1].P, Cmdline: []string{"not-a-workspace"}},
				}
				res[3] = memoryProcEntry{P: &process{PID: 3, Parent: res[2].P, Cmdline: []string{"still", "not"}}}
				res[1].P.Children = []*process{res[2].P}
				res[2].P.Children = []*process{res[3].P}

				res[4] = memoryProcEntry{
					P:   &process{PID: 4, Parent: res[3].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=bla", "GITPOD_INSTANCE_ID=blabla"},
				}
				res[5] = memoryProcEntry{P: &process{PID: 5, Parent: res[4].P, Cmdline: []string{"supervisor", "run"}}}
				res[3].P.Children = []*process{res[4].P}
				res[4].P.Children = []*process{res[5].P}

				res[6] = memoryProcEntry{
					P:   &process{PID: 6, Parent: res[3].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=second-ws", "GITPOD_INSTANCE_ID=second-ws"},
				}
				res[7] = memoryProcEntry{P: &process{PID: 7, Parent: res[4].P, Cmdline: []string{"supervisor", "run"}}}
				res[3].P.Children = []*process{res[4].P, res[6].P}
				res[6].P.Children = []*process{res[7].P}

				return res
			})(),
			Expectation: []WorkspaceAndDepth{
				{PID: 4, D: 3, K: ProcessSandbox, C: "/proc/self/exe", W: ws5},
				{PID: 5, D: 4, K: ProcessSupervisor, C: "supervisor", W: ws5},
				{PID: 6, D: 3, K: ProcessSandbox, C: "/proc/self/exe", W: ws7},
				{PID: 7, D: 4, K: ProcessSupervisor, C: "supervisor", W: ws7},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			idx := test.Proc.Discover()
			root, ok := idx[1]
			if !ok {
				t.Fatal("test has no PID 1")
			}

			findWorkspaces(test.Proc, root, 0, nil)

			var act []WorkspaceAndDepth
			for _, p := range idx {
				if p.Workspace != nil {
					act = append(act, WorkspaceAndDepth{
						W:   p.Workspace,
						D:   p.Depth,
						K:   p.Kind,
						C:   p.Cmdline[0],
						PID: p.PID,
					})
				}
			}
			sort.Slice(act, func(i, j int) bool {
				return act[i].PID < act[j].PID
			})

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected findWorkspaces (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRunDetector(t *testing.T) {
	tests := []struct {
		Name        string
		Proc        memoryProc
		Expectation []Process
	}{
		{
			Name: "happy path",
			Proc: (func() memoryProc {
				res := make(map[int]memoryProcEntry)
				res[1] = memoryProcEntry{P: &process{PID: 1}}
				res[2] = memoryProcEntry{
					P:   &process{PID: 2, Parent: res[1].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=foobar", "GITPOD_INSTANCE_ID=baz"},
				}
				res[3] = memoryProcEntry{P: &process{PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "run"}}}
				res[4] = memoryProcEntry{P: &process{PID: 4, Parent: res[3].P, Cmdline: []string{"bad-actor", "has", "args"}}}
				res[1].P.Children = []*process{res[2].P}
				res[2].P.Children = []*process{res[3].P}
				res[3].P.Children = []*process{res[4].P}
				return res
			})(),
			Expectation: []Process{
				{Path: "", CommandLine: []string{"supervisor", "run"}, Kind: ProcessSupervisor, Workspace: ws},
				{Path: "", CommandLine: []string{"bad-actor", "has", "args"}, Kind: ProcessUserWorkload, Workspace: ws},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {

			ps := make(chan Process)
			det := ProcfsDetector{
				indexSizeGuage: prometheus.NewGauge(prometheus.GaugeOpts{Name: "dont"}),
				proc:           test.Proc,
			}

			var (
				res []Process
				wg  sync.WaitGroup
			)
			wg.Add(1)
			go func() {
				defer wg.Done()
				for p := range ps {
					res = append(res, p)
				}
			}()
			det.run(ps)
			close(ps)
			wg.Wait()

			sort.Slice(res, func(i, j int) bool {
				return res[i].Kind < res[j].Kind
			})

			if diff := cmp.Diff(test.Expectation, res); diff != "" {
				t.Errorf("unexpected run (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDiscovery(t *testing.T) {
	p, err := procfs.NewFS("/proc")
	if err != nil {
		t.Fatal(err)
	}

	proc := realProcfs(p)
	res := proc.Discover()

	if len(res) == 0 {
		t.Fatal("did not discover any process")
	}
}
