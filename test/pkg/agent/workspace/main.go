// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/prometheus/procfs"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func main() {
	err := enterSupervisorNamespaces()
	if err != nil {
		panic(fmt.Sprintf("enterSupervisorNamespaces: %v", err))
	}

	integration.ServeAgent(new(WorkspaceAgent))
}

func enterSupervisorNamespaces() error {
	if os.Getenv("AGENT_IN_RING2") != "" {
		return nil
	}

	nsenter, err := exec.LookPath("nsenter")
	if err != nil {
		return xerrors.Errorf("cannot find nsenter")
	}

	// This agent expectes to be called using the workspacekit lift (i.e. in ring1).
	// We then enter the PID and mount namespace of supervisor.
	// First, we need to find the supervisor process
	proc, err := procfs.NewFS("/proc")
	if err != nil {
		return err
	}
	procs, err := proc.AllProcs()
	if err != nil {
		return err
	}
	var supervisorPID int
	for _, p := range procs {
		cmd, _ := p.CmdLine()
		for _, c := range cmd {
			if strings.HasSuffix(c, "supervisor") {
				supervisorPID = p.PID
				break
			}
		}
		if supervisorPID != 0 {
			break
		}
	}
	if supervisorPID == 0 {
		return xerrors.Errorf("no supervisor process found")
	}

	// Then we copy ourselves to a location that we can access from the supervisor NS
	self, err := os.Executable()
	if err != nil {
		return err
	}
	fn := fmt.Sprintf("/proc/%d/root/agent", supervisorPID)
	dst, err := os.OpenFile(fn, os.O_CREATE|os.O_WRONLY, 0755)
	if err != nil {
		return err
	}
	selfFD, err := os.Open(self)
	if err != nil {
		return err
	}
	defer selfFD.Close()
	_, err = io.Copy(dst, selfFD)
	if err != nil {
		return xerrors.Errorf("error copying agent: %w", err)
	}

	return unix.Exec(nsenter, append([]string{nsenter, "-t", strconv.Itoa(supervisorPID), "-m", "-p", "/agent"}, os.Args[1:]...), append(os.Environ(), "AGENT_IN_RING2=true"))
}

// WorkspaceAgent provides ingteration test services from within a workspace
type WorkspaceAgent struct {
}

// ListDir lists a directory's content
func (*WorkspaceAgent) ListDir(req *api.ListDirRequest, resp *api.ListDirResponse) error {
	dc, err := os.ReadDir(req.Dir)
	if err != nil {
		return err
	}

	*resp = api.ListDirResponse{}
	for _, c := range dc {
		resp.Files = append(resp.Files, c.Name())
	}
	return nil
}

// WriteFile writes a file in the workspace
func (*WorkspaceAgent) WriteFile(req *api.WriteFileRequest, resp *api.WriteFileResponse) (err error) {
	err = os.WriteFile(req.Path, req.Content, req.Mode)
	if err != nil {
		return
	}

	*resp = api.WriteFileResponse{}
	return
}

// Exec executes a command in the workspace
func (*WorkspaceAgent) Exec(req *api.ExecRequest, resp *api.ExecResponse) (err error) {
	cmd := exec.Command(req.Command, req.Args...)
	var (
		stdout bytes.Buffer
		stderr bytes.Buffer
	)
	if req.Dir != "" {
		cmd.Dir = req.Dir
	}
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err = cmd.Run()

	var rc int
	if err != nil {
		exitError, ok := err.(*exec.ExitError)
		if !ok {
			fullCommand := strings.Join(append([]string{req.Command}, req.Args...), " ")
			return xerrors.Errorf("%s: %w", fullCommand, err)
		}
		rc = exitError.ExitCode()
		err = nil
	}

	*resp = api.ExecResponse{
		ExitCode: rc,
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
	}
	return
}
