// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"os"
	"os/exec"
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

		err = mountWorkspaceDevice(workspaceDevice, "/workspace_pvc")
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(fsPrepCmd)
}

func prepareWorkspaceDevice(device string) error {
	var stderr bytes.Buffer
	cmd := exec.Command("mkfs.ext4", "-m1", device)
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

	// chown it so that it is owned by gitpod:gitpod when workspace starts
	if err := os.Chown(target, 133332, 133332); err != nil {
		return xerrors.Errorf("cannot chown directory %v: %w", target, err)
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
