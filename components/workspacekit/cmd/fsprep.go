// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	workspaceDevice = "/dev/workspace"
)

var fsPrepCmd = &cobra.Command{
	Use:   "fsprep",
	Short: "does fs prep and call supervisor",
	RunE: func(_ *cobra.Command, args []string) (err error) {
		defer func() {
			if err != nil {
				time.Sleep(5 * time.Minute)
			}
		}()

		isReady, err := isWorkspaceDeviceReady(workspaceDevice)
		if err != nil {
			return err
		}

		if !isReady {
			err = prepareWorkspaceDevice(workspaceDevice)
			if err != nil {
				return err
			}
		}

		err = mountWorkspaceDevice(workspaceDevice, overlay)
		if err != nil {
			return err
		}

		err = prepareForOverlay([]string{newroot, upperDir, workDir})
		if err != nil {
			return err
		}

		mountOverlay("/", upperDir, workDir, newroot)
		if err != nil {
			return err
		}

		err = pivotRoot(newroot)
		if err != nil {
			return xerrors.Errorf("cannot pivot root: %w", err)
		}

		err = unix.Chdir("/")
		if err != nil {
			return xerrors.Errorf("cannot change to root directory after pivot root: %w", err)
		}

		err = unix.Exec("/.supervisor/supervisor", []string{"init"}, os.Environ())
		if err != nil {
			return xerrors.Errorf("cannot start supervisor: %w", err)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(fsPrepCmd)
}

var (
	baseMountPoint = "/mnt"
	overlay        = filepath.Join(baseMountPoint, "overlay")
	newroot        = filepath.Join(baseMountPoint, "newRoot")

	upperDir = filepath.Join(overlay, "upper")
	workDir  = filepath.Join(overlay, "workdir")
)

func prepareWorkspaceDevice(device string) error {
	var stderr bytes.Buffer
	cmd := exec.Command("mkfs", "-m1", "-t", "ext4", device)
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		log.WithError(err).WithField("reason", stderr.String()).Error("cannot mount workspace disk")
		return xerrors.Errorf("cannot format workspace disk using ext4: %w", err)
	}

	return nil
}

func mountWorkspaceDevice(device, target string) error {
	if err := os.MkdirAll(target, 0755); err != nil {
		return xerrors.Errorf("cannot create directory %v: %w", target, err)
	}

	if err := unix.Mount(device, target, "ext4", uintptr(0), "user_xattr"); err != nil {
		return xerrors.Errorf("cannot mount workspace disk in %v: %w", target, err)
	}

	return nil
}

func isWorkspaceDeviceReady(device string) (bool, error) {
	var stderr bytes.Buffer
	cmd := exec.Command("blkid", "-o", "value", "-s", "TYPE", device)
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 2 {
				// unformatted device
				return false, nil
			}
		}

		log.WithError(err).WithField("stdout", string(out)).WithField("stderr", stderr.String()).Error("cannot obtain details from the workspace disk")
		return false, xerrors.Errorf("cannot obtain details from the workspace disk: %w", err)
	}

	return string(out) == "ext4", nil
}

func prepareForOverlay(paths []string) error {
	for _, path := range paths {
		if _, statErr := os.Stat(path); statErr != nil {
			if err := os.MkdirAll(path, 0755); err != nil {
				log.WithError(err).WithField("path", path).Error("cannot create directory")
				return xerrors.Errorf("cannot create directory %v: %w", path, err)
			}
		}
	}

	return nil
}

func mountOverlay(lower, upper, workdir, target string) {
	opts := fmt.Sprintf("metacopy=off,redirect_dir=off,lowerdir=%s,upperdir=%s,workdir=%s", lower, upper, workdir)
	if err := unix.Mount("overlay", target, "overlay", 0, opts); err != nil {
		log.WithError(err).WithField("path", target).Fatal("cannot mount overlay")
	}

	bindMount("/etc/resolv.conf", target)
	bindMount("/etc/hosts", target)
	bindMount("/etc/hostname", target)
	bindMount("/sys", target)
	bindMount("/dev", target)
	bindMount("/proc", target)
}

func bindMount(path, target string) {
	location := filepath.Join(target, path)
	if err := unix.Mount(path, location, "bind", unix.MS_BIND|unix.MS_REC, ""); err != nil {
		log.WithError(err).WithField("path", location).Fatalf("cannot bind mount %v", path)
	}
}
