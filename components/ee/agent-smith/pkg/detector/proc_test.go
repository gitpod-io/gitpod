// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package detector

import (
	"bytes"
	"fmt"
	"sort"
	"sync"
	"testing"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/google/go-cmp/cmp"
	lru "github.com/hashicorp/golang-lru"
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
				res[3] = memoryProcEntry{P: &process{PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "init"}}}
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
			Name: "multiple workspacekit children",
			Proc: (func() memoryProc {
				res := make(map[int]memoryProcEntry)
				res[1] = memoryProcEntry{P: &process{PID: 1}}
				res[2] = memoryProcEntry{
					P:   &process{PID: 2, Parent: res[1].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=foobar", "GITPOD_INSTANCE_ID=baz"},
				}
				res[3] = memoryProcEntry{P: &process{PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "init"}}}
				res[4] = memoryProcEntry{P: &process{PID: 4, Parent: res[2].P, Cmdline: []string{"slirp4netns"}}}
				res[1].P.Children = []*process{res[2].P}
				res[2].P.Children = []*process{res[3].P, res[4].P}
				return res
			})(),
			Expectation: []WorkspaceAndDepth{
				{PID: 2, D: 1, K: ProcessSandbox, C: "/proc/self/exe", W: ws},
				{PID: 3, D: 2, K: ProcessSupervisor, C: "supervisor", W: ws},
				{PID: 4, D: 2, K: ProcessUserWorkload, C: "slirp4netns", W: ws},
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
				res[3] = memoryProcEntry{P: &process{PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "init"}}}
				res[1].P.Children = []*process{res[2].P}
				res[2].P.Children = []*process{res[3].P}

				res[4] = memoryProcEntry{
					P:   &process{PID: 4, Parent: res[3].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=bla", "GITPOD_INSTANCE_ID=blabla"},
				}
				res[5] = memoryProcEntry{P: &process{PID: 5, Parent: res[4].P, Cmdline: []string{"supervisor", "init"}}}
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
				res[5] = memoryProcEntry{P: &process{PID: 5, Parent: res[4].P, Cmdline: []string{"supervisor", "init"}}}
				res[3].P.Children = []*process{res[4].P}
				res[4].P.Children = []*process{res[5].P}

				res[6] = memoryProcEntry{
					P:   &process{PID: 6, Parent: res[3].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
					Env: []string{"GITPOD_WORKSPACE_ID=second-ws", "GITPOD_INSTANCE_ID=second-ws"},
				}
				res[7] = memoryProcEntry{P: &process{PID: 7, Parent: res[4].P, Cmdline: []string{"supervisor", "init"}}}
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
		Proc        []memoryProc
		Expectation []Process
	}{
		{
			Name: "happy path",
			Proc: []memoryProc{
				(func() memoryProc {
					res := make(map[int]memoryProcEntry)
					res[1] = memoryProcEntry{P: &process{Hash: 1, PID: 1}}
					res[2] = memoryProcEntry{
						P:   &process{Hash: 2, PID: 2, Parent: res[1].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
						Env: []string{"GITPOD_WORKSPACE_ID=foobar", "GITPOD_INSTANCE_ID=baz"},
					}
					res[3] = memoryProcEntry{P: &process{Hash: 3, PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "init"}}}
					res[4] = memoryProcEntry{P: &process{Hash: 4, PID: 4, Parent: res[3].P, Cmdline: []string{"bad-actor", "has", "args"}}}
					res[1].P.Children = []*process{res[2].P}
					res[2].P.Children = []*process{res[3].P}
					res[3].P.Children = []*process{res[4].P}
					return res
				})(),
				(func() memoryProc {
					res := make(map[int]memoryProcEntry)
					res[1] = memoryProcEntry{P: &process{Hash: 1, PID: 1}}
					res[2] = memoryProcEntry{
						P:   &process{Hash: 2, PID: 2, Parent: res[1].P, Cmdline: []string{"/proc/self/exe", "ring1"}},
						Env: []string{"GITPOD_WORKSPACE_ID=foobar", "GITPOD_INSTANCE_ID=baz"},
					}
					res[3] = memoryProcEntry{P: &process{Hash: 3, PID: 3, Parent: res[2].P, Cmdline: []string{"supervisor", "init"}}}
					res[4] = memoryProcEntry{P: &process{Hash: 4, PID: 4, Parent: res[3].P, Cmdline: []string{"bad-actor", "has", "args"}}}
					res[5] = memoryProcEntry{P: &process{Hash: 5, PID: 5, Parent: res[3].P, Cmdline: []string{"another-bad-actor", "has", "args"}}}
					res[1].P.Children = []*process{res[2].P}
					res[2].P.Children = []*process{res[3].P}
					res[3].P.Children = []*process{res[4].P, res[5].P}
					return res
				})(),
			},
			Expectation: []Process{
				{Path: "", CommandLine: []string{"bad-actor", "has", "args"}, Kind: ProcessUserWorkload, Workspace: ws},
				{Path: "", CommandLine: []string{"another-bad-actor", "has", "args"}, Kind: ProcessUserWorkload, Workspace: ws},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			cache, _ := lru.New(10)
			ps := make(chan Process)
			det := ProcfsDetector{
				indexSizeGuage:     prometheus.NewGauge(prometheus.GaugeOpts{Name: "dont"}),
				cacheUseCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{}, []string{"use"}),
				workspaceGauge:     prometheus.NewGauge(prometheus.GaugeOpts{Name: "dont"}),
				cache:              cache,
			}

			var wg sync.WaitGroup
			var res []Process
			wg.Add(1)
			go func() {
				defer wg.Done()
				for p := range ps {
					res = append(res, p)
				}
			}()

			for _, proc := range test.Proc {
				det.proc = proc
				det.run(ps)
			}
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

func TestParseGitpodEnviron(t *testing.T) {
	tests := []struct {
		Name        string
		Content     string
		Expectation []string
	}{
		{
			Name:        "empty set",
			Expectation: []string{},
		},
		{
			Name:    "happy path",
			Content: "GITPOD_INSTANCE_ID=foobar\000GITPOD_SOMETHING=blabla\000SOMETHING_ELSE\000",
			Expectation: []string{
				"GITPOD_INSTANCE_ID=foobar",
				"GITPOD_SOMETHING=blabla",
			},
		},
		{
			Name: "exceed token size",
			Content: func() string {
				r := "12345678"
				for i := 0; i < 7; i++ {
					r += r
				}
				return "SOME_ENV_VAR=" + r + "\000GITPOD_FOOBAR=bar"
			}(),
			Expectation: []string{
				"GITPOD_FOOBAR=bar",
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act, err := parseGitpodEnviron(bytes.NewReader([]byte(test.Content)))
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected parseGitpodEnviron (-want +got):\n%s", diff)
			}
		})
	}
}

func benchmarkParseGitpodEnviron(content string, b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		parseGitpodEnviron(bytes.NewReader([]byte(content)))
	}
}

func BenchmarkParseGitpodEnvironP0(b *testing.B) { benchmarkParseGitpodEnviron("", b) }
func BenchmarkParseGitpodEnvironP1(b *testing.B) {
	benchmarkParseGitpodEnviron("GITPOD_INSTANCE_ID=foobar\000", b)
}
func BenchmarkParseGitpodEnvironP2(b *testing.B) {
	benchmarkParseGitpodEnviron("GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000", b)
}
func BenchmarkParseGitPodEnvironP4(b *testing.B) {
	benchmarkParseGitpodEnviron("GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000", b)
}
func BenchmarkParseGitpodEnvironP8(b *testing.B) {
	benchmarkParseGitpodEnviron("GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000GITPOD_INSTANCE_ID=foobar\000", b)
}
func BenchmarkParseGitpodEnvironN1(b *testing.B) { benchmarkParseGitpodEnviron("NOT_ME\000", b) }
func BenchmarkParseGitpodEnvironN2(b *testing.B) {
	benchmarkParseGitpodEnviron("NOT_ME\000NOT_ME\000", b)
}
func BenchmarkParseGitpodEnvironN4(b *testing.B) {
	benchmarkParseGitpodEnviron("NOT_ME\000NOT_ME\000NOT_ME\000NOT_ME\000", b)
}
func BenchmarkParseGitpodEnvironN8(b *testing.B) {
	benchmarkParseGitpodEnviron("NOT_ME\000NOT_ME\000NOT_ME\000NOT_ME\000NOT_ME\000NOT_ME\000NOT_ME\000NOT_ME\000", b)
}

func TestParseStat(t *testing.T) {
	type Expectation struct {
		S   *stat
		Err string
	}
	tests := []struct {
		Name        string
		Content     string
		Expectation Expectation
	}{
		{
			Name:        "empty set",
			Expectation: Expectation{Err: "cannot parse stat"},
		},
		{
			Name:        "happy path",
			Content:     "80275 (cat) R 717 80275 717 34817 80275 4194304 85 0 0 0 0 0 0 0 26 6 1 0 4733826 5771264 135 18446744073709551615 94070799228928 94070799254577 140722983793472 0 0 0 0 0 0 0 0 0 17 14 0 0 0 0 0 94070799272592 94070799274176 94070803738624 140722983801930 140722983801950 140722983801950 140722983821291 0",
			Expectation: Expectation{S: &stat{PPID: 717, Starttime: 4733826}},
		},
		{
			Name:        "pid 1",
			Content:     "1 (systemd) S 0 1 1 0 -1 4194560 62769 924461 98 1590 388 255 2488 1097 20 0 1 0 63 175169536 3435 18446744073709551615 94093530578944 94093531561125 140726309452800 0 0 0 671173123 4096 1260 1 0 0 17 3 0 0 32 0 0 94093531915152 94093532201000 94093562523648 140726309453736 140726309453747 140726309453747 140726309453805 0",
			Expectation: Expectation{S: &stat{Starttime: 63}},
		},
		{
			Name:        "kthreadd",
			Content:     "2 (kthreadd) S 0 0 0 0 -1 2129984 0 0 0 0 3 0 0 0 20 0 1 0 63 0 0 18446744073709551615 0 0 0 0 0 0 0 2147483647 0 1 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0",
			Expectation: Expectation{S: &stat{Starttime: 63}},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var (
				act Expectation
				err error
			)
			act.S, err = parseStat(bytes.NewReader([]byte(test.Content)))
			if err != nil {
				act.Err = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected parseStat (-want +got):\n%s", diff)
			}
		})
	}
}

func BenchmarkParseStat(b *testing.B) {
	r := bytes.NewReader([]byte("80275 (cat) R 717 80275 717 34817 80275 4194304 85 0 0 0 0 0 0 0 26 6 1 0 4733826 5771264 135 18446744073709551615 94070799228928 94070799254577 140722983793472 0 0 0 0 0 0 0 0 0 17 14 0 0 0 0 0 94070799272592 94070799274176 94070803738624 140722983801930 140722983801950 140722983801950 140722983821291 0"))

	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		parseStat(r)
	}
}
