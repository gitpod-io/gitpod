// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build linux
// +build linux

package nsenter

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"

	"golang.org/x/sys/unix"

	"github.com/gitpod-io/gitpod/common-go/log"
)

type Namespace int

const (
	// NamespaceMount refers to the mount namespace
	NamespaceMount = iota
	// NamespaceNet refers to the network namespace
	NamespaceNet
	// NamespaceNet refers to the network namespace
	NamespacePID
)

// Run executes a workspacekit handler in a namespace.
// Use preflight to check libseccomp.NotifIDValid().
func Run(pid int, args []string, addFD []*os.File, enterNamespace ...Namespace) error {
	nss := []struct {
		Env    string
		Source string
		Flags  int
		NS     Namespace
	}{
		{"_LIBNSENTER_ROOTFD", fmt.Sprintf("/proc/%d/root", pid), unix.O_PATH, -1},
		{"_LIBNSENTER_CWDFD", fmt.Sprintf("/proc/%d/cwd", pid), unix.O_PATH, -1},
		{"_LIBNSENTER_MNTNSFD", fmt.Sprintf("/proc/%d/ns/mnt", pid), os.O_RDONLY, NamespaceMount},
		{"_LIBNSENTER_NETNSFD", fmt.Sprintf("/proc/%d/ns/net", pid), os.O_RDONLY, NamespaceNet},
		{"_LIBNSENTER_PIDNSFD", fmt.Sprintf("/proc/%d/ns/pid", pid), os.O_RDONLY, NamespacePID},
	}

	stdioFdCount := 3
	cmd := exec.Command("/proc/self/exe", append([]string{"handler"}, args...)...)
	cmd.ExtraFiles = append(cmd.ExtraFiles, addFD...)
	cmd.Env = append(cmd.Env, "_LIBNSENTER_INIT=1")
	for _, ns := range nss {
		var enter bool
		if ns.NS == -1 {
			enter = true
		} else {
			for _, s := range enterNamespace {
				if ns.NS == s {
					enter = true
					break
				}
			}
		}
		if !enter {
			continue
		}

		f, err := os.OpenFile(ns.Source, ns.Flags, 0)
		if err != nil {
			return xerrors.Errorf("cannot open %s: %w", ns.Source, err)
		}
		defer f.Close()
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%d", ns.Env, stdioFdCount+len(cmd.ExtraFiles)))
		cmd.ExtraFiles = append(cmd.ExtraFiles, f)
	}

	log.WithField("env", cmd.Env).WithField("extraFiles", len(cmd.ExtraFiles)).WithField("args", args).WithField("pid", pid).Debug("calling handler")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		return xerrors.Errorf("cannot run handler: %w", err)
	}
	return nil
}

// Mount executes mount in the mount namespace of PID
func Mount(pid int, source, target string, fstype string, flags int, data string) error {
	args := []string{"mount",
		"--source", source,
		"--target", target,
		"--flags", strconv.Itoa(flags),
	}
	if fstype != "" {
		args = append(args, "--fstype", fstype)
	}
	if data != "" {
		args = append(args, "--data", data)
	}
	return Run(pid, args, nil, NamespaceMount)
}

func MoveMount(pid int, fromFD *os.File, target string) error {
	args := []string{"move-mount",
		"--fd", "3",
		"--dest", target,
	}
	return Run(pid, args, []*os.File{fromFD}, NamespaceMount)
}
