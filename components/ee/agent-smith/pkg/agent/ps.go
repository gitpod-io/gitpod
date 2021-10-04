// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"bufio"
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

var PS_COLUMNS = []string{"etimes", "pid", "ppid", "comm", "args"}

type Process struct {
	// Process ID
	PID uint64
	// Parent Process ID
	PPID uint64
	// Filename of the running binary
	Filename string
	// Args string
	Args string
	// ElapsedTimeSeconds since process start
	ElapsedTimeSeconds uint64
	// Children contains pointers to all child processes
	Children []*Process
}

func (p *Process) IsSupervisor() bool {
	// TODO(gpl) In the outer context we know the list of container roots processes; we could use that to verify this local "thruth" and FindSupervisorForRootProcess
	return p.Filename == "supervisor" && p.Args == "run"
}

func (p *Process) ElapsedTime() time.Duration {
	return time.Second * time.Duration(p.ElapsedTimeSeconds)
}

type ProcessMap struct {
	ps   []Process
	pmap map[uint64]*Process
}

func NewProcessMap(capacity int) *ProcessMap {
	return &ProcessMap{
		ps:   make([]Process, 0, capacity),
		pmap: make(map[uint64]*Process, capacity),
	}
}

// FindSupervisorForChild simply walks up the process tree.
// TODO(gpl) this can be easily be cached
func (m *ProcessMap) FindSupervisorForChild(pid uint64) *Process {
	p := m.GetByPID(pid)
	for p != nil {
		if p.IsSupervisor() {
			return p
		}
		p, _ = m.GetParent(p.PID)
	}

	return nil
}

// FindSupervisorForRootProcess relies on the process hierarchy layout: supervisor is running as only 2nd level child of "ring0"
func (m *ProcessMap) FindSupervisorForRootProcess(pid uint64) *Process {
	ring0 := m.GetByPID(pid)
	if ring0 == nil || len(ring0.Children) != 1 {
		return nil
	}

	ring1 := ring0.Children[0]
	if ring1 == nil || len(ring1.Children) != 1 {
		return nil
	}
	supervisor := ring1.Children[0]
	if supervisor == nil || !supervisor.IsSupervisor() {
		return nil
	}
	return supervisor
}

func (m *ProcessMap) Insert(pid uint64, ppid uint64, filename string, args string, etimes uint64) *Process {
	p, alreadyPresent := m.pmap[pid]
	if alreadyPresent {
		p.PPID = ppid
		p.Filename = filename
		p.Args = args
		p.ElapsedTimeSeconds = etimes
		return p
	}

	process := Process{
		PID:                pid,
		PPID:               ppid,
		Filename:           filename,
		Args:               args,
		ElapsedTimeSeconds: etimes,
	}
	m.ps = append(m.ps, process)
	p = &m.ps[len(m.ps)-1]
	m.pmap[p.PID] = p

	parent := m.GetOrCreate(ppid)
	parent.Children = append(parent.Children, p)

	return p
}

func (m *ProcessMap) GetOrCreate(pid uint64) *Process {
	p, alreadyPresent := m.pmap[pid]
	if alreadyPresent {
		return p
	}

	process := Process{
		PID: pid,
	}
	m.ps = append(m.ps, process)
	p = &m.ps[len(m.ps)-1]
	m.pmap[p.PID] = p

	return p
}

func (m *ProcessMap) GetByPID(pid uint64) *Process {
	p, ok := m.pmap[pid]
	if !ok {
		return nil
	}
	return p
}

func (m *ProcessMap) GetParent(pid uint64) (parent *Process, ok bool) {
	p := m.GetByPID(pid)
	if p == nil {
		return nil, false
	}

	// root?
	if p.PPID == 0 {
		return nil, true
	}

	parent = m.GetByPID(p.PPID)
	return parent, true
}

func (m *ProcessMap) List() *[]Process {
	return &m.ps
}

func (m *ProcessMap) ListAllChildren(pid uint64) []*Process {
	pss := make([]*Process, 0)

	p := m.GetByPID(pid)
	if p == nil {
		return nil
	}

	stack := []*Process{p}
	for len(stack) > 0 {
		p, stack = stack[len(stack)-1], stack[:len(stack)-1]

		pss = append(pss, p)
		stack = append(stack, p.Children...)
	}

	return pss
}

func RunPs() (*ProcessMap, error) {
	cmd := exec.Command("ps", "-e", "-o", strings.Join(PS_COLUMNS, ","), "--no-headers")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return nil, err
	}

	return ParsePsOutput(&out)
}

func ParsePsOutput(output *bytes.Buffer) (*ProcessMap, error) {
	m := NewProcessMap(1000)
	scanner := bufio.NewScanner(output)
	for scanner.Scan() {
		var (
			pid      uint64
			ppid     uint64
			filename string
			args     string
			etimes   uint64
		)
		colsParsed, err := fmt.Sscanf(scanner.Text(), "%d %d %d %s %s", &etimes, &pid, &ppid, &filename, &args)
		if err != nil {
			return nil, fmt.Errorf("unable to scan ps output: %w", err)
		}
		if colsParsed != len(PS_COLUMNS) {
			return nil, fmt.Errorf("unable to scan ps output: expected %d but got %d columns", len(PS_COLUMNS), colsParsed)
		}
		m.Insert(pid, ppid, filename, args, etimes)
	}
	return m, nil
}
