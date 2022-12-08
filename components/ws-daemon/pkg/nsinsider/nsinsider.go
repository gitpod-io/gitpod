// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package nsinsider

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/sys/unix"
)

type NsinsiderOpts struct {
	MountNS    bool
	PidNS      bool
	NetNS      bool
	MountNSPid int
}

func EnterMountNS(enter bool) nsinsiderOpt {
	return func(o *NsinsiderOpts) {
		o.MountNS = enter
	}
}

func EnterPidNS(enter bool) nsinsiderOpt {
	return func(o *NsinsiderOpts) {
		o.PidNS = enter
	}
}

func EnterNetNS(enter bool) nsinsiderOpt {
	return func(o *NsinsiderOpts) {
		o.NetNS = enter
	}
}

func EnterMountNSPid(pid int) nsinsiderOpt {
	return func(o *NsinsiderOpts) {
		o.MountNS = true
		o.MountNSPid = pid
	}
}

type nsinsiderOpt func(*NsinsiderOpts)

func Nsinsider(instanceID string, targetPid int, mod func(*exec.Cmd), opts ...nsinsiderOpt) error {
	cfg := NsinsiderOpts{
		MountNS: true,
	}
	for _, o := range opts {
		o(&cfg)
	}

	base, err := os.Executable()
	if err != nil {
		return err
	}

	type mnt struct {
		Env    string
		Source string
		Flags  int
	}
	var nss []mnt
	if cfg.MountNS {
		tpid := targetPid
		if cfg.MountNSPid != 0 {
			tpid = cfg.MountNSPid
		}
		nss = append(nss,
			mnt{"_LIBNSENTER_ROOTFD", fmt.Sprintf("/proc/%d/root", tpid), unix.O_PATH},
			mnt{"_LIBNSENTER_CWDFD", fmt.Sprintf("/proc/%d/cwd", tpid), unix.O_PATH},
			mnt{"_LIBNSENTER_MNTNSFD", fmt.Sprintf("/proc/%d/ns/mnt", tpid), os.O_RDONLY},
		)
	}
	if cfg.PidNS {
		nss = append(nss, mnt{"_LIBNSENTER_PIDNSFD", fmt.Sprintf("/proc/%d/ns/pid", targetPid), os.O_RDONLY})
	}
	if cfg.NetNS {
		nss = append(nss, mnt{"_LIBNSENTER_NETNSFD", fmt.Sprintf("/proc/%d/ns/net", targetPid), os.O_RDONLY})
	}

	stdioFdCount := 3
	cmd := exec.Command(filepath.Join(filepath.Dir(base), "nsinsider"))
	mod(cmd)
	cmd.Env = append(cmd.Env, "_LIBNSENTER_INIT=1", "GITPOD_INSTANCE_ID="+instanceID)
	for _, ns := range nss {
		f, err := os.OpenFile(ns.Source, ns.Flags, 0)
		if err != nil {
			return fmt.Errorf("cannot open %s: %w", ns.Source, err)
		}
		defer f.Close()
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%d", ns.Env, stdioFdCount+len(cmd.ExtraFiles)))
		cmd.ExtraFiles = append(cmd.ExtraFiles, f)
	}

	var cmdOut bytes.Buffer
	cmd.Stdout = &cmdOut
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	err = cmd.Run()
	log.FromBuffer(&cmdOut, log.WithFields(log.OWI("", "", instanceID)))
	if err != nil {
		out, oErr := cmd.CombinedOutput()
		if oErr != nil {
			return fmt.Errorf("run nsinsider (%v) \n%v\n output error: %v",
				cmd.Args,
				err,
				oErr,
			)
		}
		return fmt.Errorf("run nsinsider (%v) failed: %q\n%v",
			cmd.Args,
			string(out),
			err,
		)
	}
	return nil
}
